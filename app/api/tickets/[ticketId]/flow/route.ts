import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import path from 'path'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { getGatewayManager } from '@/lib/gateway/manager'
import type { Ticket, TicketFlowHistory, Status } from '@/lib/db/schema.js'

interface RouteParams {
  params: Promise<{ ticketId: string }>
}

// Default flow prompt template
const DEFAULT_FLOW_TEMPLATE = `You are {$agentId}.
Your responsible status: {$currentStatusName}
Status objective/description: {$currentStatusDescription}
Status instructions override: {$statusInstructions}
Temp file path: {$tempPath}

Task:
{$ticketJson}

Before starting, read latest comments:
{$commentsJson}

{$skills}

Available APIs:
1) GET /api/tickets/{$ticketId}/flow/view  -> get latest task + flow context
2) GET /api/tickets/{$ticketId}/flow/skills  -> get skills for current status (returns array with id, name, description)
3) POST /api/tickets/{$ticketId}/flow/skills/detail  -> get full skill data
   body example:
   {
     "skill_ids": ["skill_123", "skill_456"]
   }
4) POST /api/tickets/{$ticketId}/comments
   body example:
   {
     "content": "[Agent {$agentId}] Status={$currentStatusName} | I implemented X, validated Y, next step is Z.",
     "is_agent_completion_signal": false
   }
5) POST /api/tickets/{$ticketId}/finished
   body example:
   {
     "notes": "Completed this status. Summary: <what you did>, Evidence: <tests/checks>, Handoff: <next status context>."
   }
6) POST /api/tickets/{$ticketId}/failed
   body example:
   {
     "notes": "Failed on this status. Blocker: <reason>. Attempted: <what you tried>. Needs: <what is required>."
   }
7) POST /api/tickets/{$ticketId}/pause
   body example:
   {
     "notes": "Paused for user input. Question: <what you need>. Context: <why needed>."
   }

Execution policy:
- Perform work for this status using your skills.
- You MUST provide a concrete progress comment (what you changed, what you checked, what remains).
- If you need to create files (e.g., code, configs, artifacts) that other agents or systems need to read, use {$tempPath} as the base directory.
- If user input is required, choose result=pause and explain exactly what answer is needed.
- If success, choose result=finished.
- If blocked/failure, choose result=failed with root cause.

IMPORTANT: Respond in plain text (NOT JSON, no code blocks, no markdown) using EXACTLY this format:
RESULT: finished
COMMENT: I completed the task by doing X, Y, and Z.
SUMMARY: Task completed successfully with all requirements met.

Alternative formats accepted:
- Plain text with keywords: "finished", "failed", or "pause"
- JSON: {"result": "finished", "comment": "...", "notes": "..."}

If you don't follow the format, your response will be treated as "finished" by default.`

/**
 * Replace template variables with actual values
 * @param template - The template string with {$variableName} placeholders
 * @param variables - Object mapping variable names to their values
 * @returns Template with all variables replaced
 */
function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\$${key}\\}`, 'g')
    result = result.replace(regex, value)
  }
  return result
}

function extractText(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((v) => extractText(v, depth + 1)).filter(Boolean).join('\n')
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>
    const priority = ['message', 'content', 'text', 'output', 'result', 'data']
    for (const key of priority) {
      if (key in rec) {
        const out = extractText(rec[key], depth + 1)
        if (out) return out
      }
    }
    return Object.values(rec).map((v) => extractText(v, depth + 1)).filter(Boolean).join('\n')
  }
  return ''
}

function parseAgentFlowResult(rawText: string): {
  result: 'finished' | 'failed' | 'pause'
  notes: string
  progressComment: string
} {
  const text = rawText.trim()
  if (!text) {
    return {
      result: 'finished',
      notes: 'Agent completed with empty response.',
      progressComment: 'Agent completed the task.',
    }
  }

  try {
    const parsed = JSON.parse(text) as {
      result?: string
      decision?: string
      action?: string
      notes?: string
      final_summary?: string
      comment?: string
      progress_comment?: string
    }

    const normalizedResult = (parsed.result || parsed.decision || parsed.action || '').toLowerCase()
    const progressComment =
      parsed.progress_comment ||
      parsed.comment ||
      parsed.notes ||
      parsed.final_summary ||
      'No progress comment provided by agent.'
    const notes = parsed.final_summary || parsed.notes || parsed.comment || text

    if (normalizedResult === 'failed') {
      return { result: 'failed', notes, progressComment }
    }
    if (normalizedResult === 'finished') {
      return { result: 'finished', notes, progressComment }
    }
    if (normalizedResult === 'pause' || normalizedResult === 'waiting') {
      return { result: 'pause', notes, progressComment }
    }
  } catch {
    // ignore parse errors and continue with text heuristics
  }

  const marker = (label: string) => {
    const rx = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'im')
    const m = text.match(rx)
    return m?.[1]?.trim() || ''
  }
  const markerResult = marker('result') || marker('decision') || marker('action')
  const markerComment = marker('comment') || marker('progress_comment')
  const markerNotes = marker('notes') || marker('summary')

  if (markerResult) {
    const normalized = markerResult.toLowerCase()
    const result: 'finished' | 'failed' | 'pause' =
      normalized.includes('fail') ? 'failed' : normalized.includes('pause') || normalized.includes('wait') ? 'pause' : 'finished'
    return {
      result,
      notes: markerNotes || markerComment || text,
      progressComment: markerComment || markerNotes || text,
    }
  }

  if (/\b(result|decision|action|flow_result)\s*:\s*(pause|waiting)\b/i.test(text) || /\bpause(d)?\b/i.test(text)) {
    return {
      result: 'pause',
      notes: text,
      progressComment: text,
    }
  }

  if (/\b(result|flow_result)\s*:\s*failed\b/i.test(text) || /\bfailed\b/i.test(text)) {
    return { result: 'failed', notes: text, progressComment: text }
  }

  return { result: 'finished', notes: text, progressComment: text }
}

async function findClientForAgent(workspaceId: string, agentId: string) {
  const db = getDatabase()
  const manager = getGatewayManager()
  const gateways = db.prepare(
    'SELECT id, name FROM gateways WHERE workspace_id = ? ORDER BY created_at ASC'
  ).all(workspaceId) as Array<{ id: string; name: string }>

  for (const gateway of gateways) {
    const client = manager.getClient(gateway.id)
    if (!client || !client.isConnected()) continue
    try {
      const agents = await client.listAgents()
      if (agents.some((a) => a.id === agentId)) {
        return { client, gatewayId: gateway.id, gatewayName: gateway.name }
      }
    } catch {
      // skip broken gateway and continue scanning
    }
  }

  return null
}

function buildFlowPrompt(params: {
  ticket: Ticket
  currentStatus: Status
  agentId: string
  statusInstructions: string | null
  recentComments: Array<{ id: string; content: string; created_at: string; email: string }>
  workspaceId: string
}): string {
  const { ticket, currentStatus, agentId, statusInstructions, recentComments, workspaceId } = params
  const db = getDatabase()

  // Fetch custom template from workspace settings
  const customTemplateSetting = db.prepare(
    'SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?'
  ).get(workspaceId, 'flow_prompt_template') as { setting_value: string | null } | undefined

  const template = customTemplateSetting?.setting_value || DEFAULT_FLOW_TEMPLATE

  // Fetch skills for this status
  const skills = db.prepare(`
    SELECT s.id, s.skill_name, s.skill_description
    FROM status_skills ss
    JOIN skills s ON ss.skill_id = s.id
    WHERE ss.status_id = ? AND s.workspace_id = ? AND s.is_active = 1
    ORDER BY ss.priority ASC
  `).all(currentStatus.id, workspaceId) as Array<{
    id: string
    skill_name: string
    skill_description: string | null
  }>

  // Build skills section for prompt - show as array of skills with names and descriptions
  let skillsSection = ''
  if (skills.length > 0) {
    skillsSection = JSON.stringify(
      skills.map(skill => ({
        id: skill.id,
        name: skill.skill_name,
        description: skill.skill_description || ''
      })),
      null,
      2
    )
  } else {
    skillsSection = '[]'
  }

  // Prepare variables for template replacement
  const commentsJson = JSON.stringify(recentComments, null, 2)
  const ticketJson = JSON.stringify({
    ...ticket,
    description: null,
    task_todo: ticket.description
  }, null, 2)

  const variables = {
    ticketId: ticket.id,
    ticketNumber: String(ticket.ticket_number),
    ticketTitle: ticket.title,
    ticketDescription: ticket.description || 'No description',
    currentStatusId: currentStatus.id,
    currentStatusName: currentStatus.name,
    currentStatusDescription: currentStatus.description || 'No status description provided.',
    agentId: agentId,
    statusInstructions: statusInstructions || 'No extra instructions provided.',
    commentsJson: commentsJson,
    ticketJson: ticketJson,
    workspaceId: workspaceId,
    skills: skillsSection,
    tempPath: path.join(process.cwd(), 'temp'),
  }

  const prompt = replaceTemplateVariables(template, variables)

  console.log("[Prompt of flow]:", prompt)
  return prompt
}

async function triggerAgentForFlowStart(args: {
  ticketId: string
  workspaceId: string
  userId: string
}) {
  const { ticketId, workspaceId, userId } = args
  const db = getDatabase()

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?').get(ticketId, workspaceId) as Ticket | undefined
  if (!ticket) return

  const currentFlowConfig = db.prepare(`
    SELECT * FROM ticket_flow_configs
    WHERE ticket_id = ? AND status_id = ? AND is_included = 1
  `).get(ticketId, ticket.status_id) as {
    status_id: string
    agent_id: string | null
    instructions_override: string | null
  } | undefined

  if (!currentFlowConfig?.agent_id) {
    const now = new Date().toISOString()
    db.prepare('UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?').run(
      'waiting',
      now,
      ticketId
    )

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

  const status = db.prepare('SELECT * FROM statuses WHERE id = ?').get(ticket.status_id) as Status | undefined
  if (!status) return

  const recentComments = db.prepare(`
    SELECT tc.id, tc.content, tc.created_at, u.email
    FROM ticket_comments tc
    LEFT JOIN users u ON u.id = tc.created_by
    WHERE tc.ticket_id = ?
    ORDER BY tc.created_at DESC
    LIMIT 10
  `).all(ticketId) as Array<{ id: string; content: string; created_at: string; email: string }>

  const clientMatch = await findClientForAgent(workspaceId, currentFlowConfig.agent_id)
  if (!clientMatch) {
    const now = new Date().toISOString()
    db.prepare('UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?').run(
      'failed',
      now,
      ticketId
    )

    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticketId,
      'flow_failed',
      currentFlowConfig.agent_id,
      'agent',
      null,
      JSON.stringify({ reason: `Agent ${currentFlowConfig.agent_id} is not reachable from connected gateways` }),
      now
    )
    return
  }

  const prompt = buildFlowPrompt({
    ticket,
    currentStatus: status,
    agentId: currentFlowConfig.agent_id,
    statusInstructions: currentFlowConfig.instructions_override || status.instructions_override,
    recentComments: recentComments.reverse(),
    workspaceId: workspaceId,
  })

  try {
    const response = await clientMatch.client.sendChatMessageAndWait(
      `agent:${currentFlowConfig.agent_id}:main`,
      prompt,
      { timeoutMs: 180000 }
    )

    const messageText = response.error ? response.error : extractText(response.message)
    const parsed = parseAgentFlowResult(messageText)

    // Persist one normal agent comment (avoid duplicate style)
    const now = new Date().toISOString()
    const commentId = generateUserId()
    const normalizedAgentComment = parsed.result === 'pause'
      ? `[Agent ${currentFlowConfig.agent_id}] Waiting: ${parsed.progressComment}`
      : `[Agent ${currentFlowConfig.agent_id}] ${parsed.progressComment} | Summary: ${parsed.notes}`

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
      currentFlowConfig.agent_id,
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

    // Drive flow result using existing endpoint semantics by direct DB writes here
    const oldTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket
    const cfg = db.prepare(
      'SELECT * FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ?'
    ).get(ticketId, oldTicket.status_id) as {
      flow_order: number
      on_failed_goto: string | null
      agent_id: string | null
    } | undefined

    let nextStatusId: string | null = null
    let nextFlowingStatus: 'flowing' | 'waiting' | 'failed' | 'completed' = 'waiting'

    if (parsed.result === 'failed') {
      nextFlowingStatus = 'failed'
      nextStatusId = cfg?.on_failed_goto || null
    } else if (parsed.result === 'pause') {
      nextFlowingStatus = 'waiting'
      nextStatusId = oldTicket.status_id
    } else {
      const nextCfg = db.prepare(`
        SELECT status_id FROM ticket_flow_configs
        WHERE ticket_id = ? AND flow_order > ? AND is_included = 1
        ORDER BY flow_order ASC
        LIMIT 1
      `).get(ticketId, cfg?.flow_order ?? -1) as { status_id: string } | undefined
      nextStatusId = nextCfg?.status_id || null
      if (!nextStatusId) nextFlowingStatus = 'completed'
    }

    let shouldAutoTriggerNext = false
    if (parsed.result === 'finished' && oldTicket.flow_mode === 'automatic' && nextStatusId) {
      const nextCfgWithAgent = db.prepare(
        `SELECT agent_id FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1`
      ).get(ticketId, nextStatusId) as { agent_id: string | null } | undefined

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
      currentFlowConfig.agent_id,
      'agent',
      JSON.stringify({ from_status_id: oldTicket.status_id, result: parsed.result }),
      JSON.stringify({ to_status_id: nextStatusId, flowing_status: nextFlowingStatus }),
      applyNow
    )

    if (shouldAutoTriggerNext) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      triggerAgentForFlowStart({
        ticketId,
        workspaceId,
        userId,
      })
    }
  } catch (error) {
    const now = new Date().toISOString()
    db.prepare('UPDATE tickets SET flowing_status = ?, updated_at = ? WHERE id = ?').run('failed', now, ticketId)
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
      JSON.stringify({ reason: error instanceof Error ? error.message : String(error) }),
      now
    )
  }
}

/**
 * GET /api/tickets/[ticketId]/flow
 * Get flow status and next status for a ticket
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { ticketId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    const db = getDatabase()

    // Get user's current workspace
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }
    const workspaceId = session.current_workspace_id

    // Get ticket
    const ticket = db.prepare(
      'SELECT * FROM tickets WHERE id = ? AND workspace_id = ?'
    ).get(ticketId, workspaceId) as Ticket | undefined

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Get current flow config
    const currentFlowConfig = db.prepare(`
      SELECT tfc.*, s.name as status_name, s.color as status_color
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ? AND tfc.status_id = ?
    `).get(ticketId, ticket.status_id) as {
      id: string
      status_id: string
      status_name: string
      status_color: string
      flow_order: number
      agent_id: string | null
      on_failed_goto: string | null
      ask_approve_to_continue: boolean
      is_included: boolean
    } | undefined

    // Get next flow config
    const nextFlowConfig = db.prepare(`
      SELECT tfc.*, s.name as status_name, s.color as status_color
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ? AND tfc.flow_order > ? AND tfc.is_included = 1
      ORDER BY tfc.flow_order ASC
      LIMIT 1
    `).get(ticketId, currentFlowConfig?.flow_order ?? -1) as {
      id: string
      status_id: string
      status_name: string
      status_color: string
      flow_order: number
      agent_id: string | null
      on_failed_goto: string | null
      ask_approve_to_continue: boolean
    } | undefined

    // Get active agent session if any
    const agentSession = db.prepare(`
      SELECT * FROM chat_sessions
      WHERE id = ?
    `).get(ticket.current_agent_session_id) as {
      id: string
      agent_id: string
      agent_name: string
      last_activity_at: string
      status: string
    } | undefined

    return NextResponse.json({
      flow_enabled: ticket.flow_enabled,
      flowing_status: ticket.flowing_status || 'stopped',
      current_status: currentFlowConfig ? {
        id: currentFlowConfig.status_id,
        name: currentFlowConfig.status_name,
        color: currentFlowConfig.status_color,
        agent_id: currentFlowConfig.agent_id,
        on_failed_goto: currentFlowConfig.on_failed_goto,
        ask_approve_to_continue: currentFlowConfig.ask_approve_to_continue
      } : null,
      next_status: nextFlowConfig ? {
        id: nextFlowConfig.status_id,
        name: nextFlowConfig.status_name,
        color: nextFlowConfig.status_color,
        agent_id: nextFlowConfig.agent_id,
        on_failed_goto: nextFlowConfig.on_failed_goto,
        ask_approve_to_continue: nextFlowConfig.ask_approve_to_continue
      } : null,
      active_session: agentSession ? {
        id: agentSession.id,
        agent_id: agentSession.agent_id,
        agent_name: agentSession.agent_name,
        last_activity_at: agentSession.last_activity_at,
        status: agentSession.status
      } : null
    })
  } catch (error) {
    console.error('Error fetching flow status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tickets/[ticketId]/flow
 * Advance flow to next status or mark as failed
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return processFlowPost(request, { params })
}

export async function processFlowPost(
  request: NextRequest,
  { params }: RouteParams,
  forcedResult?: 'finished' | 'failed' | 'pause'
) {
  try {
    await ensureDatabase()

    const { ticketId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({})) as {
      action?: 'start' | 'stop' | 'pause'
      result?: 'finished' | 'failed' | 'pause'
      notes?: string
    }
    const action = body.action
    const result = forcedResult || body.result
    const { notes } = body

    if (action && action !== 'start' && action !== 'stop' && action !== 'pause') {
      return NextResponse.json(
        { message: 'Invalid action. Must be "start", "stop", or "pause"' },
        { status: 400 }
      )
    }

    if (!action && result !== 'finished' && result !== 'failed' && result !== 'pause') {
      return NextResponse.json(
        { message: 'Invalid payload. Provide action=start|stop|pause or result=finished|failed|pause' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    // Get user's current workspace
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }
    const workspaceId = session.current_workspace_id

    // Get ticket
    const ticket = db.prepare(
      'SELECT * FROM tickets WHERE id = ? AND workspace_id = ?'
    ).get(ticketId, workspaceId) as Ticket | undefined

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    if (!ticket.flow_enabled) {
      return NextResponse.json(
        { message: 'Flow is not enabled for this ticket' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    if (action === 'start') {
      db.prepare(
        `UPDATE tickets
         SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
         WHERE id = ?`
      ).run('flowing', now, now, ticketId)

      const auditLogId = generateUserId()
      db.prepare(
        `INSERT INTO ticket_audit_logs (
          id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        auditLogId,
        ticketId,
        'flow_started',
        user.id,
        'user',
        JSON.stringify({ flowing_status: ticket.flowing_status || 'stopped' }),
        JSON.stringify({ flowing_status: 'flowing' }),
        now
      )

      // Trigger current status agent in background after start
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      triggerAgentForFlowStart({
        ticketId,
        workspaceId,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        action: 'start',
        flowing_status: 'flowing',
      })
    }

    if (action === 'stop') {
      db.prepare(
        `UPDATE tickets
         SET flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ?
         WHERE id = ?`
      ).run('stopped', now, now, ticketId)

      const auditLogId = generateUserId()
      db.prepare(
        `INSERT INTO ticket_audit_logs (
          id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        auditLogId,
        ticketId,
        'flow_stopped',
        user.id,
        'user',
        JSON.stringify({ flowing_status: ticket.flowing_status || 'stopped' }),
        JSON.stringify({ flowing_status: 'stopped' }),
        now
      )

      return NextResponse.json({
        success: true,
        action: 'stop',
        flowing_status: 'stopped',
      })
    }

    if (action === 'pause') {
      db.prepare(
        `UPDATE tickets
         SET flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ?
         WHERE id = ?`
      ).run('waiting', now, now, ticketId)

      const auditLogId = generateUserId()
      db.prepare(
        `INSERT INTO ticket_audit_logs (
          id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        auditLogId,
        ticketId,
        'flow_stopped',
        user.id,
        'user',
        JSON.stringify({ flowing_status: ticket.flowing_status || 'stopped' }),
        JSON.stringify({ flowing_status: 'waiting', reason: notes || 'paused' }),
        now
      )

      return NextResponse.json({
        success: true,
        action: 'pause',
        flowing_status: 'waiting',
      })
    }

    // Get current flow config
    const currentFlowConfig = db.prepare(`
      SELECT * FROM ticket_flow_configs
      WHERE ticket_id = ? AND status_id = ?
    `).get(ticketId, ticket.status_id) as {
      id: string
      status_id: string
      flow_order: number
      agent_id: string | null
      on_failed_goto: string | null
      ask_approve_to_continue: boolean
    } | undefined

    if (!currentFlowConfig) {
      return NextResponse.json(
        { message: 'Current status not found in flow configuration' },
        { status: 400 }
      )
    }

    let nextStatusId: string | null = null
    let nextFlowingStatus: 'flowing' | 'waiting' | 'failed' | 'completed' = 'waiting'

    if (result === 'failed') {
      nextFlowingStatus = 'failed'
      if (currentFlowConfig.on_failed_goto) {
        nextStatusId = currentFlowConfig.on_failed_goto
      }
    } else if (result === 'pause') {
      nextFlowingStatus = 'waiting'
      nextStatusId = ticket.status_id
    } else if (result === 'finished') {
      // Get next status in flow
      const nextFlowConfig = db.prepare(`
        SELECT * FROM ticket_flow_configs
        WHERE ticket_id = ? AND flow_order > ? AND is_included = 1
        ORDER BY flow_order ASC
        LIMIT 1
      `).get(ticketId, currentFlowConfig.flow_order) as {
        status_id: string
      } | undefined

      nextStatusId = nextFlowConfig?.status_id || null
      if (!nextStatusId) {
        nextFlowingStatus = 'completed'
      }
    }

    let shouldAutoTriggerNext = false
    if (result === 'finished' && ticket.flow_mode === 'automatic' && nextStatusId) {
      const nextCfgWithAgent = db.prepare(
        `SELECT agent_id FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1`
      ).get(ticketId, nextStatusId) as { agent_id: string | null } | undefined

      if (nextCfgWithAgent?.agent_id) {
        nextFlowingStatus = 'flowing'
        shouldAutoTriggerNext = true
      } else {
        nextFlowingStatus = 'waiting'
      }
    }

    // Get status info for response
    const oldStatus = db.prepare(
      'SELECT * FROM statuses WHERE id = ?'
    ).get(ticket.status_id) as Status

    let newStatus: Status | null = null
    if (nextStatusId) {
      newStatus = db.prepare(
        'SELECT * FROM statuses WHERE id = ?'
      ).get(nextStatusId) as Status
    }

    if (nextStatusId && result !== 'pause') {
      // Update ticket status
      db.prepare(
        `UPDATE tickets
         SET status_id = ?, flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(nextStatusId, nextFlowingStatus, now, now, ticketId)
    } else {
      db.prepare(
        `UPDATE tickets
         SET flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(nextFlowingStatus, now, now, ticketId)
    }

    // Create flow history entry
    const flowHistoryId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_flow_history (
        id, ticket_id, from_status_id, to_status_id, agent_id, session_id,
        flow_result, notes, started_at, completed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      flowHistoryId,
      ticketId,
      ticket.status_id,
      nextStatusId || ticket.status_id,
      currentFlowConfig.agent_id,
      ticket.current_agent_session_id,
      result,
      notes || null,
      ticket.last_flow_check_at || now,
      now,
      now
    )

    // Clear agent session
    db.prepare(
      'UPDATE tickets SET current_agent_session_id = NULL WHERE id = ?'
    ).run(ticketId)

    // Create audit log
    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticketId,
      result === 'pause' ? 'flow_stopped' : 'flow_transition',
      user.id,
      'user',
      JSON.stringify({ from_status_id: ticket.status_id, result }),
      JSON.stringify({ to_status_id: nextStatusId }),
      now
    )

    if (shouldAutoTriggerNext) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      triggerAgentForFlowStart({
        ticketId,
        workspaceId,
        userId: user.id,
      })
    }

    return NextResponse.json({
      success: true,
      action: result,
      flowing_status: nextFlowingStatus,
      old_status: {
        id: oldStatus.id,
        name: oldStatus.name,
        color: oldStatus.color
      },
      new_status: newStatus ? {
        id: newStatus.id,
        name: newStatus.name,
        color: newStatus.color
      } : null,
      flow_history: {
        id: flowHistoryId,
        result,
        notes
      }
    })
  } catch (error) {
    console.error('Error updating flow:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
