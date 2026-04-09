import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { modelHasVisionCapability, buildFlowPrompt } from './flow-helpers.js'
import { findClientForAgent } from './find-client.js'
import { parseAgentFlowResult, extractText } from './parse-result.js'
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
      `
    SELECT COUNT(*) as count FROM tickets WHERE workspace_id = ? AND flowing_status = 'flowing'
  `
    )
    .get(workspaceId) as { count: number }

  const onflowlimitSetting = db
    .prepare(
      `
    SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = 'onflowlimit'
  `
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
      `
    SELECT id, workspace_id FROM tickets
    WHERE workspace_id = ? AND flowing_status = 'waiting_to_flow'
    ORDER BY updated_at ASC
    LIMIT ?
  `
    )
    .all(workspaceId, availableSlots) as Array<{
    id: string
    workspace_id: string
  }>

  for (const ticket of waitingTickets) {
    const now = new Date().toISOString()
    db.prepare(
      `
      UPDATE tickets
      SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
      WHERE id = ?
    `
    ).run('flowing', now, now, ticket.id)

    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticket.id,
      'flow_started',
      'system',
      'system',
      JSON.stringify({ flowing_status: 'waiting_to_flow' }),
      JSON.stringify({
        flowing_status: 'flowing',
        reason: 'Flow slot became available',
      }),
      now
    )

    await triggerAgentForFlowStart({
      ticketId: ticket.id,
      workspaceId: ticket.workspace_id,
      userId: 'system',
      sessionToken: '',
    })
  }
}

/**
 * Main function to trigger agent for flow start
 */
export async function triggerAgentForFlowStart(args: {
  ticketId: string
  workspaceId: string
  userId: string
  sessionToken: string
}): Promise<void> {
  const { ticketId, workspaceId, userId, sessionToken } = args
  const db = getDatabase()

  const ticket = db
    .prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?')
    .get(ticketId, workspaceId) as Ticket | undefined
  if (!ticket) return

  const status = db
    .prepare('SELECT * FROM statuses WHERE id = ?')
    .get(ticket.status_id) as Status | undefined
  if (!status) return

  const currentFlowConfig = db
    .prepare(
      `
    SELECT * FROM ticket_flow_configs
    WHERE ticket_id = ? AND status_id = ? AND is_included = 1
  `
    )
    .get(ticketId, ticket.status_id) as
    | {
        status_id: string
        agent_id: string | null
        instructions_override: string | null
      }
    | undefined

  const effectiveAgentId = currentFlowConfig?.agent_id || status.agent_id

  if (!effectiveAgentId) {
    const now = new Date().toISOString()
    db.prepare(
      'UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?'
    ).run('waiting', now, ticketId)

    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticketId,
      'flow_failed',
      'system',
      'system',
      null,
      JSON.stringify({ reason: 'No agent configured for current flow status' }),
      now
    )
    return
  }

  const recentComments = db
    .prepare(
      `
    SELECT tc.id, tc.content, tc.created_at, u.email
    FROM ticket_comments tc
    LEFT JOIN users u ON u.id = tc.created_by
    WHERE tc.ticket_id = ?
    ORDER BY tc.created_at DESC
    LIMIT 10
  `
    )
    .all(ticketId) as Array<{
    id: string
    content: string
    created_at: string
    email: string
  }>

  // Log context about the flow trigger attempt
  logger.debug(
    `[triggerAgentForFlowStart] Flow trigger context: ticketId=${ticketId}, agentId=${effectiveAgentId}, statusId=${ticket.status_id}, flowMode=${ticket.flow_mode}, sessionToken=${sessionToken ? 'provided' : 'empty'}`
  )

  // Retry logic: try multiple times with exponential backoff before giving up
  const MAX_RETRIES = 5
  const INITIAL_DELAY_MS = 1000
  let clientMatch = null
  let lastError: Error | null = null

  logger.debug(
    `[triggerAgentForFlowStart] Starting agent lookup for ${effectiveAgentId} with ${MAX_RETRIES} retries`
  )

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const attemptStartTime = Date.now()
    clientMatch = await findClientForAgent(workspaceId, effectiveAgentId)
    const attemptDuration = Date.now() - attemptStartTime

    logger.debug(
      `[triggerAgentForFlowStart] Attempt ${attempt}/${MAX_RETRIES} for agent ${effectiveAgentId}: found=${!!clientMatch}, duration=${attemptDuration}ms`
    )

    if (clientMatch) {
      logger.debug(
        `[triggerAgentForFlowStart] Successfully found agent ${effectiveAgentId} on attempt ${attempt}`
      )
      break
    }

    if (attempt < MAX_RETRIES) {
      // Exponential backoff: 1s, 2s, 4s, 8s
      const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  if (!clientMatch) {
    const now = new Date().toISOString()
    db.prepare(
      'UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?'
    ).run('failed', now, ticketId)

    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticketId,
      'flow_failed',
      effectiveAgentId,
      'agent',
      null,
      JSON.stringify({
        reason: `Agent ${effectiveAgentId} is not reachable from connected gateways (tried ${MAX_RETRIES} times)`,
      }),
      now
    )
    return
  }

  const hasVision = clientMatch.agentModel
    ? modelHasVisionCapability(clientMatch.agentModel)
    : false

  const timeoutSetting = db
    .prepare(
      'SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?'
    )
    .get(workspaceId, 'flow_timeout_seconds') as
    | { setting_value: string | null }
    | undefined
  const flowTimeoutSeconds = timeoutSetting?.setting_value
    ? parseInt(timeoutSetting.setting_value)
    : 1800
  const timeoutMs = flowTimeoutSeconds * 1000

  const prompt = buildFlowPrompt({
    ticket,
    currentStatus: status,
    agentId: effectiveAgentId,
    statusInstructions:
      currentFlowConfig?.instructions_override || status.instructions_override,
    recentComments: recentComments.reverse(),
    workspaceId,
    hasVisionCapability: hasVision,
    sessionToken,
  })

  let sessionKey = `agent:${effectiveAgentId}:main`

  const existingSession = ticket.current_agent_session_id
    ? (db
        .prepare('SELECT * FROM chat_sessions WHERE id = ?')
        .get(ticket.current_agent_session_id) as
        | { id: string; session_key: string }
        | undefined)
    : null

  if (existingSession) {
    sessionKey = existingSession.session_key
  } else {
    const newChatSessionId = randomUUID()
    sessionKey = `agent:${effectiveAgentId}:${newChatSessionId}`
    const now = new Date().toISOString()

    db.prepare(
      `
      INSERT INTO chat_sessions (
        id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key, status, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      newChatSessionId,
      workspaceId,
      userId,
      clientMatch.gatewayId,
      effectiveAgentId,
      clientMatch.agentName || 'Agent',
      sessionKey,
      'idle',
      now,
      now,
      now
    )

    db.prepare(
      'UPDATE tickets SET current_agent_session_id = ? WHERE id = ?'
    ).run(newChatSessionId, ticketId)
  }

  try {
    const response = await clientMatch.client.sendChatMessageAndWait(
      sessionKey,
      prompt,
      { timeoutMs }
    )

    const isTimeoutError = !!response.error
    const errorMessage = response.error || 'Unknown error'
    const messageText = isTimeoutError
      ? errorMessage
      : extractText(response.message)
    const parsed = isTimeoutError
      ? {
          result: 'failed' as const,
          notes: errorMessage,
          progressComment: `Agent timeout or error: ${errorMessage}`,
        }
      : parseAgentFlowResult(messageText)

    const now = new Date().toISOString()
    const commentId = generateUserId()
    const normalizedAgentComment =
      parsed.result === 'pause'
        ? `[Agent ${effectiveAgentId}] Waiting: ${parsed.progressComment}`
        : `[Agent ${effectiveAgentId}] ${parsed.progressComment} | Summary: ${parsed.notes}`

    db.prepare(
      `INSERT INTO ticket_comments (
        id, ticket_id, content, created_by, is_agent_completion_signal, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      commentId,
      ticketId,
      normalizedAgentComment,
      userId,
      parsed.result === 'pause' ? 0 : 1,
      now,
      now
    )

    const commentAuditId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      commentAuditId,
      ticketId,
      'comment_added',
      effectiveAgentId,
      'agent',
      null,
      JSON.stringify({
        source: 'flow-agent',
        comment_id: commentId,
        note: parsed.progressComment,
        summary: parsed.notes,
        result: parsed.result,
      }),
      now
    )

    const oldTicket = db
      .prepare('SELECT * FROM tickets WHERE id = ?')
      .get(ticketId) as Ticket
    const cfg = db
      .prepare(
        'SELECT * FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ?'
      )
      .get(ticketId, oldTicket.status_id) as
      | {
          flow_order: number
          on_failed_goto: string | null
          agent_id: string | null
        }
      | undefined

    let nextStatusId: string | null = null
    let nextFlowingStatus: 'flowing' | 'waiting' | 'failed' | 'completed' =
      'waiting'

    if (parsed.result === 'failed') {
      nextFlowingStatus = 'failed'
      nextStatusId = cfg?.on_failed_goto || null
    } else if (parsed.result === 'pause') {
      nextFlowingStatus = 'waiting'
      nextStatusId = oldTicket.status_id
    } else {
      const nextCfg = db
        .prepare(
          `
        SELECT status_id FROM ticket_flow_configs
        WHERE ticket_id = ? AND flow_order > ? AND is_included = 1
        ORDER BY flow_order ASC
        LIMIT 1
      `
        )
        .get(ticketId, cfg?.flow_order ?? -1) as
        | { status_id: string }
        | undefined
      nextStatusId = nextCfg?.status_id || null
      if (!nextStatusId) nextFlowingStatus = 'completed'
    }

    let shouldAutoTriggerNext = false
    if (
      parsed.result === 'finished' &&
      oldTicket.flow_mode === 'automatic' &&
      nextStatusId
    ) {
      const nextCfgWithAgent = db
        .prepare(
          `SELECT agent_id FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1`
        )
        .get(ticketId, nextStatusId) as { agent_id: string | null } | undefined

      if (nextCfgWithAgent?.agent_id) {
        nextFlowingStatus = 'flowing'
        shouldAutoTriggerNext = true
      } else {
        nextFlowingStatus = 'waiting'
      }
    }

    const applyNow = new Date().toISOString()
    if (nextStatusId && parsed.result !== 'pause') {
      db.prepare(
        'UPDATE tickets SET status_id = ?, flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ? WHERE id = ?'
      ).run(nextStatusId, nextFlowingStatus, applyNow, applyNow, ticketId)
    } else {
      db.prepare(
        'UPDATE tickets SET flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ? WHERE id = ?'
      ).run(nextFlowingStatus, applyNow, applyNow, ticketId)
    }

    const flowAuditId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      flowAuditId,
      ticketId,
      parsed.result === 'pause' ? 'flow_stopped' : 'flow_transition',
      effectiveAgentId,
      'agent',
      JSON.stringify({
        from_status_id: oldTicket.status_id,
        result: parsed.result,
      }),
      JSON.stringify({
        to_status_id: nextStatusId,
        flowing_status: nextFlowingStatus,
      }),
      applyNow
    )

    if (shouldAutoTriggerNext) {
      await triggerAgentForFlowStart({
        ticketId,
        workspaceId,
        userId,
        sessionToken,
      })
    }
  } catch (error) {
    const now = new Date().toISOString()
    db.prepare(
      'UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?'
    ).run('failed', now, ticketId)
    const commentId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_comments (
        id, ticket_id, content, created_by, is_agent_completion_signal, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      commentId,
      ticketId,
      `[Agent Failure] ${error instanceof Error ? error.message : String(error)}`,
      userId,
      1,
      now,
      now
    )

    const failureAuditId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      failureAuditId,
      ticketId,
      'flow_failed',
      'system',
      'system',
      null,
      JSON.stringify({
        reason: error instanceof Error ? error.message : String(error),
      }),
      now
    )
  }
}
