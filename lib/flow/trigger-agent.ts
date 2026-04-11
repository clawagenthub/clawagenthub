import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { modelHasVisionCapability, buildFlowPrompt } from './flow-helpers.js'
import { findClientForAgent } from './find-client.js'
import { parseAgentFlowResult, extractText } from './parse-result.js'
import { createSession } from '@/lib/auth/session.js'
import type { Ticket, Status } from './flow-types.js'
import logger from '@/lib/logger/index.js'

/**
 * Trigger waiting tickets when a flow slot becomes available
 */
export async function triggerWaitingTickets(
  workspaceId: string
): Promise<void> {
  const db = getDatabase()

  const currentFlowingCount = db
    .prepare(
      `SELECT COUNT(*) as count FROM tickets WHERE workspace_id = ? AND flowing_status = 'flowing'`
    )
    .get(workspaceId) as { count: number }

  const onflowlimitSetting = db
    .prepare(
      `SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = 'onflowlimit'`
    )
    .get(workspaceId) as { setting_value: string } | undefined

  const onflowlimit = onflowlimitSetting?.setting_value
    ? parseInt(onflowlimitSetting.setting_value)
    : 5

  if (onflowlimit <= 0) return

  const availableSlots = onflowlimit - currentFlowingCount.count
  if (availableSlots <= 0) return

  const waitingTickets = db
    .prepare(
      `SELECT id, workspace_id FROM tickets WHERE workspace_id = ? AND flowing_status = 'waiting_to_flow' ORDER BY updated_at ASC LIMIT ?`
    )
    .all(workspaceId, availableSlots) as Array<{
    id: string
    workspace_id: string
  }>

  for (const ticket of waitingTickets) {
    const now = new Date().toISOString()
    db.prepare(
      `UPDATE tickets SET flowing_status = ?, last_flow_check_at = ?, updated_at = ? WHERE id = ?`
    ).run('flowing', now, now, ticket.id)

    db.prepare(
      `INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateUserId(),
      ticket.id,
      'flow_started',
      'system',
      'system',
      JSON.stringify({ flowing_status: 'waiting_to_flow' }),
      JSON.stringify({ flowing_status: 'flowing', reason: 'Flow slot became available' }),
      now
    )

    // Get a valid system user ID for flow triggers
    const systemUserId = (() => {
      const workspace = db
        .prepare('SELECT owner_id FROM workspaces LIMIT 1')
        .get() as { owner_id: string } | undefined
      if (workspace?.owner_id) return workspace.owner_id
      const superuser = db
        .prepare('SELECT id FROM users WHERE is_superuser = 1 LIMIT 1')
        .get() as { id: string } | undefined
      if (superuser?.id) return superuser.id
      const firstUser = db.prepare('SELECT id FROM users LIMIT 1').get() as
        | { id: string }
        | undefined
      if (firstUser?.id) return firstUser.id
      return 'system'
    })()

    // Create a session for system user to use for API auth in flow prompts
    const systemSession = createSession(systemUserId, 'system-flow-trigger')

    await triggerAgentForFlowStart({
      ticketId: ticket.id,
      workspaceId: ticket.workspace_id,
      userId: systemUserId,
      sessionToken: systemSession.token,
    })
  }
}

// ============================================================================
// Sub-functions
// ============================================================================

interface AgentContext {
  ticket: Ticket
  status: Status
  effectiveAgentId: string
}

/**
 * Resolves agent context: ticket, status, effectiveAgentId. Returns null if no agent.
 */
async function resolveAgentContext(
  ticketId: string,
  workspaceId: string
): Promise<AgentContext | null> {
  const db = getDatabase()

  const ticket = db
    .prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?')
    .get(ticketId, workspaceId) as Ticket | undefined
  if (!ticket) return null

  const status = db
    .prepare('SELECT * FROM statuses WHERE id = ?')
    .get(ticket.status_id) as Status | undefined
  if (!status) return null

  const flowConfig = db
    .prepare(
      `SELECT * FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1`
    )
    .get(ticketId, ticket.status_id) as
    | { agent_id: string | null; instructions_override: string | null }
    | undefined

  const effectiveAgentId = flowConfig?.agent_id || status.agent_id
  if (!effectiveAgentId) {
    const now = new Date().toISOString()
    db.prepare(`UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?`).run('waiting', now, ticketId)
    db.prepare(
      `INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateUserId(),
      ticketId,
      'flow_failed',
      'system',
      'system',
      null,
      JSON.stringify({ reason: 'No agent configured for current flow status' }),
      now
    )
    return null
  }

  return { ticket, status, effectiveAgentId }
}

/**
 * Finds agent client with retry and exponential backoff. Returns null if not found.
 */
async function findAgentClient(
  workspaceId: string,
  effectiveAgentId: string
): Promise<{ gatewayId: string; agentName: string; agentModel: string; client: unknown } | null> {
  const MAX_RETRIES = 5
  const INITIAL_DELAY_MS = 1000

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now()
    const clientMatch = await findClientForAgent(workspaceId, effectiveAgentId)
    logger.debug(
      `[triggerAgentForFlowStart] Attempt ${attempt}/${MAX_RETRIES}: found=${!!clientMatch}, duration=${Date.now() - startTime}ms`
    )
    if (clientMatch) return clientMatch as typeof clientMatch
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, INITIAL_DELAY_MS * Math.pow(2, attempt - 1)))
    }
  }
  return null
}

/**
 * Manages session: reuse existing or create new chat session.
 */
async function manageSession(
  ticket: Ticket,
  effectiveAgentId: string,
  clientMatch: { gatewayId: string; agentName: string },
  userId: string,
  workspaceId: string
): Promise<string> {
  const db = getDatabase()
  let sessionKey = `agent:${effectiveAgentId}:main`

  if (ticket.current_agent_session_id) {
    const existing = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ?')
      .get(ticket.current_agent_session_id) as { session_key: string } | undefined
    if (existing) return existing.session_key
  }

  const newId = randomUUID()
  sessionKey = `agent:${effectiveAgentId}:${newId}`
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key, status, last_activity_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(newId, workspaceId, userId, clientMatch.gatewayId, effectiveAgentId, clientMatch.agentName || 'Agent', sessionKey, 'idle', now, now, now)

  db.prepare(`UPDATE tickets SET current_agent_session_id = ? WHERE id = ?`).run(newId, ticket.id)
  return sessionKey
}

/**
 * Sends prompt to agent and waits for response.
 */
async function communicateWithAgent(
  client: { sendChatMessageAndWait(sessionKey: string, prompt: string, options: { timeoutMs: number }): Promise<{ error?: string; message?: unknown }> },
  sessionKey: string,
  prompt: string,
  timeoutMs: number
): Promise<{ result: 'finished' | 'failed' | 'pause'; notes: string; progressComment: string }> {
  const response = await client.sendChatMessageAndWait(sessionKey, prompt, { timeoutMs })
  const isError = !!response.error
  const messageText = isError ? response.error! : extractText(response.message)
  return isError
    ? { result: 'failed', notes: messageText, progressComment: `Agent timeout or error: ${messageText}` }
    : parseAgentFlowResult(messageText)
}

/**
 * Transitions flow state: persists comments, logs audit, updates ticket status.
 */
async function transitionFlowState(
  ticketId: string,
  workspaceId: string,
  userId: string,
  effectiveAgentId: string,
  parsed: { result: 'finished' | 'failed' | 'pause'; notes: string; progressComment: string },
  _sessionKey: string,
  sessionToken: string
): Promise<void> {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Persist agent comment
  const commentId = generateUserId()
  const commentText =
    parsed.result === 'pause'
      ? `[Agent ${effectiveAgentId}] Waiting: ${parsed.progressComment}`
      : `[Agent ${effectiveAgentId}] ${parsed.progressComment} | Summary: ${parsed.notes}`

  db.prepare(
    `INSERT INTO ticket_comments (id, ticket_id, content, created_by, is_agent_completion_signal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(commentId, ticketId, commentText, userId, parsed.result === 'pause' ? 0 : 1, now, now)

  db.prepare(
    `INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    generateUserId(),
    ticketId,
    'comment_added',
    effectiveAgentId,
    'agent',
    null,
    JSON.stringify({ source: 'flow-agent', comment_id: commentId, note: parsed.progressComment, summary: parsed.notes, result: parsed.result }),
    now
  )

  // Determine next state
  const oldTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket
  const cfg = db
    .prepare('SELECT * FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ?')
    .get(ticketId, oldTicket.status_id) as { flow_order: number; on_failed_goto: string | null } | undefined

  let nextStatusId: string | null = null
  let nextFlowingStatus: 'flowing' | 'waiting' | 'failed' | 'completed' = 'waiting'

  if (parsed.result === 'failed') {
    nextFlowingStatus = 'failed'
    nextStatusId = cfg?.on_failed_goto || null
  } else if (parsed.result === 'pause') {
    nextFlowingStatus = 'waiting'
    nextStatusId = oldTicket.status_id
  } else {
    const nextCfg = db
      .prepare(`SELECT status_id FROM ticket_flow_configs WHERE ticket_id = ? AND flow_order > ? AND is_included = 1 ORDER BY flow_order ASC LIMIT 1`)
      .get(ticketId, cfg?.flow_order ?? -1) as { status_id: string } | undefined
    nextStatusId = nextCfg?.status_id || null
    if (!nextStatusId) nextFlowingStatus = 'completed'
  }

  // Auto-trigger check
  let shouldAutoTriggerNext = false
  if (parsed.result === 'finished' && oldTicket.flow_mode === 'automatic' && nextStatusId) {
    const nextCfgWithAgent = db
      .prepare(`SELECT agent_id FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1`)
      .get(ticketId, nextStatusId) as { agent_id: string | null } | undefined
    if (nextCfgWithAgent?.agent_id) {
      nextFlowingStatus = 'flowing'
      shouldAutoTriggerNext = true
    } else {
      nextFlowingStatus = 'waiting'
    }
  }

  // Apply ticket update
  if (nextStatusId && parsed.result !== 'pause') {
    db.prepare(`UPDATE tickets SET status_id = ?, flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ? WHERE id = ?`)
      .run(nextStatusId, nextFlowingStatus, now, now, ticketId)
  } else {
    db.prepare(`UPDATE tickets SET flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ? WHERE id = ?`)
      .run(nextFlowingStatus, now, now, ticketId)
  }

  db.prepare(
    `INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    generateUserId(),
    ticketId,
    parsed.result === 'pause' ? 'flow_stopped' : 'flow_transition',
    effectiveAgentId,
    'agent',
    JSON.stringify({ from_status_id: oldTicket.status_id, result: parsed.result }),
    JSON.stringify({ to_status_id: nextStatusId, flowing_status: nextFlowingStatus }),
    now
  )

  if (shouldAutoTriggerNext) {
    await triggerAgentForFlowStart({ ticketId, workspaceId, userId, sessionToken })
  }
}

// ============================================================================
// Main orchestrator
// ============================================================================

/**
 * Main function to trigger agent for flow start.
 * Thin orchestrator (~45 lines).
 */
export async function triggerAgentForFlowStart(args: {
  ticketId: string
  workspaceId: string
  userId: string
  sessionToken: string
}): Promise<void> {
  const { ticketId, workspaceId, userId, sessionToken } = args

  const context = await resolveAgentContext(ticketId, workspaceId)
  if (!context) return

  logger.debug(
    `[triggerAgentForFlowStart] Flow trigger: ticketId=${ticketId}, agentId=${context.effectiveAgentId}, statusId=${context.ticket.status_id}`
  )

  const clientMatch = await findAgentClient(workspaceId, context.effectiveAgentId)
  if (!clientMatch) {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare(`UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?`).run('failed', now, ticketId)
    db.prepare(
      `INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateUserId(),
      ticketId,
      'flow_failed',
      context.effectiveAgentId,
      'agent',
      null,
      JSON.stringify({ reason: `Agent ${context.effectiveAgentId} is not reachable (tried 5 times)` }),
      now
    )
    return
  }

  // Build prompt
  const db = getDatabase()
  const hasVision = modelHasVisionCapability(clientMatch.agentModel)
  const timeoutSetting = db
    .prepare(`SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?`)
    .get(workspaceId, 'flow_timeout_seconds') as { setting_value: string | null } | undefined
  const timeoutMs = (timeoutSetting?.setting_value ? parseInt(timeoutSetting.setting_value) : 1800) * 1000

  const flowConfig = db
    .prepare(`SELECT * FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1`)
    .get(ticketId, context.ticket.status_id) as { instructions_override: string | null } | undefined

  const recentComments = db
    .prepare(`SELECT tc.id, tc.content, tc.created_at, u.email FROM ticket_comments tc LEFT JOIN users u ON u.id = tc.created_by WHERE tc.ticket_id = ? ORDER BY tc.created_at DESC LIMIT 10`)
    .all(ticketId) as Array<{ id: string; content: string; created_at: string; email: string }>

  const prompt = buildFlowPrompt({
    ticket: context.ticket,
    currentStatus: context.status,
    agentId: context.effectiveAgentId,
    statusInstructions: flowConfig?.instructions_override || context.status.instructions_override,
    recentComments: recentComments.reverse(),
    workspaceId,
    hasVisionCapability: hasVision,
    sessionToken,
  })

  const sessionKey = await manageSession(context.ticket, context.effectiveAgentId, clientMatch, userId, workspaceId)

  try {
    const parsed = await communicateWithAgent(
      clientMatch.client as { sendChatMessageAndWait(sessionKey: string, prompt: string, options: { timeoutMs: number }): Promise<{ error?: string; message?: unknown }> },
      sessionKey,
      prompt,
      timeoutMs
    )
    await transitionFlowState(ticketId, workspaceId, userId, context.effectiveAgentId, parsed, sessionKey, sessionToken)
  } catch (error) {
    const now = new Date().toISOString()
    db.prepare(`UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?`).run('failed', now, ticketId)
    db.prepare(
      `INSERT INTO ticket_comments (id, ticket_id, content, created_by, is_agent_completion_signal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateUserId(),
      ticketId,
      `[Agent Failure] ${error instanceof Error ? error.message : String(error)}`,
      userId,
      1,
      now,
      now
    )
    db.prepare(
      `INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateUserId(),
      ticketId,
      'flow_failed',
      'system',
      'system',
      null,
      JSON.stringify({ reason: error instanceof Error ? error.message : String(error) }),
      now
    )
  }
}
