import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/index.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { generateUserId } from '@/lib/auth/token.js'
import { triggerAgentForFlowStart, triggerWaitingTickets } from './trigger-agent.js'
import { validateFlowAction, validateFlowEnabled } from './flow-validators.js'
import type { FlowPostBody, FlowConfigWithStatus } from './flow-types.js'
import type { Status } from '@/lib/db/schema.js'

/**
 * Process flow POST request
 */
export async function processFlowPost(
  request: NextRequest,
  ticketId: string,
  workspaceId: string,
  user: { id: string },
  sessionToken: string,
  body: FlowPostBody,
  forcedResult?: 'finished' | 'failed' | 'pause'
): Promise<NextResponse> {
  const db = getDatabase()
  const now = new Date().toISOString()
  const result = forcedResult || body.result
  const { notes } = body

  // Handle start action
  if (body.action === 'start') {
    return handleFlowStart(db, ticketId, workspaceId, user.id, now)
  }

  // Handle stop action
  if (body.action === 'stop') {
    return handleFlowStop(db, ticketId, user.id, now)
  }

  // Handle pause action
  if (body.action === 'pause') {
    return handleFlowPause(db, ticketId, user.id, notes, now)
  }

  // Trigger waiting tickets
  await triggerWaitingTickets(workspaceId)

  // Get current flow config
  const currentFlowConfig = db.prepare(`
    SELECT * FROM ticket_flow_configs
    WHERE ticket_id = ? AND status_id = ?
  `).get(ticketId, db.prepare('SELECT status_id FROM tickets WHERE id = ?').get(ticketId) as { status_id: string } | undefined) as {
    id: string
    status_id: string
    flow_order: number
    agent_id: string | null
    on_failed_goto: string | null
    ask_approve_to_continue: boolean
  } | undefined

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as {
    id: string
    status_id: string
    flowing_status: string
    flow_mode: string
    current_agent_session_id: string | null
    last_flow_check_at: string
  } | undefined

  if (!currentFlowConfig || !ticket) {
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
    const nextFlowConfig = db.prepare(`
      SELECT * FROM ticket_flow_configs
      WHERE ticket_id = ? AND flow_order > ? AND is_included = 1
      ORDER BY flow_order ASC
      LIMIT 1
    `).get(ticketId, currentFlowConfig.flow_order) as { status_id: string } | undefined

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

  const oldStatus = db.prepare('SELECT * FROM statuses WHERE id = ?').get(ticket.status_id) as Status

  let newStatus: Status | null = null
  if (nextStatusId) {
    newStatus = db.prepare('SELECT * FROM statuses WHERE id = ?').get(nextStatusId) as Status
  }

  if (nextStatusId && result !== 'pause') {
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

  db.prepare('UPDATE tickets SET current_agent_session_id = NULL WHERE id = ?').run(ticketId)

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
    await triggerAgentForFlowStart({
      ticketId,
      workspaceId,
      userId: user.id,
      sessionToken,
    })
  }

  await triggerWaitingTickets(workspaceId)

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
}

/**
 * Handle flow start action
 */
async function handleFlowStart(
  db: ReturnType<typeof getDatabase>,
  ticketId: string,
  workspaceId: string,
  userId: string,
  now: string
): Promise<NextResponse> {
  const currentFlowingCount = db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE workspace_id = ? AND flowing_status = 'flowing'
  `).get(workspaceId) as { count: number }

  const onflowlimitSetting = db.prepare(`
    SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = 'onflowlimit'
  `).get(workspaceId) as { setting_value: string } | undefined

  const onflowlimit = onflowlimitSetting?.setting_value ? parseInt(onflowlimitSetting.setting_value) : 5

  if (onflowlimit > 0 && currentFlowingCount.count >= onflowlimit) {
    db.prepare(
      `UPDATE tickets
       SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
       WHERE id = ?`
    ).run('waiting_to_flow', now, now, ticketId)

    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticketId,
      'flow_waiting',
      userId,
      'user',
      JSON.stringify({ flowing_status: 'stopped' }),
      JSON.stringify({ flowing_status: 'waiting_to_flow', reason: `Max concurrent flowing tickets (${onflowlimit}) reached` }),
      now
    )

    return NextResponse.json({
      success: true,
      action: 'start',
      flowing_status: 'waiting_to_flow',
      message: `Ticket queued - max concurrent flowing tickets (${onflowlimit}) reached`,
    })
  }

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
    userId,
    'user',
    JSON.stringify({ flowing_status: 'stopped' }),
    JSON.stringify({ flowing_status: 'flowing' }),
    now
  )

  return NextResponse.json({
    success: true,
    action: 'start',
    flowing_status: 'flowing',
  })
}

/**
 * Handle flow stop action
 */
async function handleFlowStop(
  db: ReturnType<typeof getDatabase>,
  ticketId: string,
  userId: string,
  now: string
): Promise<NextResponse> {
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
    userId,
    'user',
    JSON.stringify({ flowing_status: 'flowing' }),
    JSON.stringify({ flowing_status: 'stopped' }),
    now
  )

  return NextResponse.json({
    success: true,
    action: 'stop',
    flowing_status: 'stopped',
  })
}

/**
 * Handle flow pause action
 */
async function handleFlowPause(
  db: ReturnType<typeof getDatabase>,
  ticketId: string,
  userId: string,
  notes: string | undefined,
  now: string
): Promise<NextResponse> {
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
    userId,
    'user',
    JSON.stringify({ flowing_status: 'flowing' }),
    JSON.stringify({ flowing_status: 'waiting', reason: notes || 'paused' }),
    now
  )

  return NextResponse.json({
    success: true,
    action: 'pause',
    flowing_status: 'waiting',
  })
}
