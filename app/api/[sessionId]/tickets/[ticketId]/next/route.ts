import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { generateUserId } from '@/lib/auth/token.js'
import { triggerAgentForFlowStart, triggerWaitingTickets } from '@/lib/flow/trigger-agent'
import type { Ticket, Status } from '@/lib/db/schema'
import logger, { logCategories } from '@/lib/logger/index.js'

interface RouteParams {
  params: Promise<{ sessionId: string; ticketId: string }>
}

interface FlowConfigs {
  currentFlowConfig: any
  nextFlowConfig: any
  currentStatus: Status
  newStatus: Status
}

/**
 * POST /api/{sessionId}/tickets/[ticketId]/next
 * Advance a ticket to the next flow stage (session-scoped)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { sessionId, ticketId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
      workspaceId: sessionId
    })

    if (!verification.valid) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    // Get the ticket
    const ticket = db
      .prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?')
      .get(ticketId, workspaceId) as Ticket | undefined

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    }

    if (!ticket.flow_enabled) {
      return NextResponse.json(
        { message: 'Flow is not enabled for this ticket' },
        { status: 400 }
      )
    }

    // Get current status info
    const currentStatus = db
      .prepare('SELECT * FROM statuses WHERE id = ?')
      .get(ticket.status_id) as Status | undefined

    if (!currentStatus) {
      return NextResponse.json(
        { message: 'Current status not found' },
        { status: 400 }
      )
    }

    // Validate transition
    if (currentStatus.name.toLowerCase() === 'done') {
      return NextResponse.json(
        { error: 'INVALID_TRANSITION', message: "Cannot advance from 'done' - use /finished", hint: 'Call POST /finished' },
        { status: 400 }
      )
    }
    if (currentStatus.name.toLowerCase() === 'completed') {
      return NextResponse.json(
        { error: 'INVALID_TRANSITION', message: 'Ticket is already completed' },
        { status: 400 }
      )
    }

    // Get current flow config
    const currentFlowConfig = db
      .prepare('SELECT * FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1')
      .get(ticket.id, ticket.status_id)

    if (!currentFlowConfig) {
      return NextResponse.json(
        { message: 'Current status not found in flow configuration' },
        { status: 400 }
      )
    }

    // Get next flow config
    const nextFlowConfig = db
      .prepare('SELECT tfc.*, s.name as status_name, s.color as status_color FROM ticket_flow_configs tfc LEFT JOIN statuses s ON tfc.status_id = s.id WHERE tfc.ticket_id = ? AND tfc.flow_order > ? AND tfc.is_included = 1 ORDER BY tfc.flow_order ASC LIMIT 1')
      .get(ticket.id, (currentFlowConfig as any).flow_order) as any

    if (!nextFlowConfig) {
      return NextResponse.json(
        { error: 'INVALID_TRANSITION', message: 'No next stage exists in the flow', hint: 'Use /finished' },
        { status: 400 }
      )
    }

    const newStatus = db
      .prepare('SELECT * FROM statuses WHERE id = ?')
      .get(nextFlowConfig.status_id) as Status

    // Determine flow transition
    const nextFlowingStatus = (ticket.flow_mode === 'automatic' && nextFlowConfig.agent_id)
      ? 'flowing'
      : 'waiting'

    const shouldAutoTriggerNext = nextFlowingStatus === 'flowing'

    const now = new Date().toISOString()

    // Update ticket status
    db.prepare(
      'UPDATE tickets SET status_id = ?, flowing_status = ?, last_flow_check_at = ?, updated_at = ? WHERE id = ?'
    ).run(nextFlowConfig.status_id, nextFlowingStatus, now, now, ticketId)

    // Create flow history entry
    const flowHistoryId = generateUserId()
    db.prepare(
      'INSERT INTO ticket_flow_history (id, ticket_id, from_status_id, to_status_id, agent_id, session_id, flow_result, notes, started_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      flowHistoryId,
      ticketId,
      ticket.status_id,
      nextFlowConfig.status_id,
      currentFlowConfig.agent_id,
      ticket.current_agent_session_id,
      'next',
      null,
      ticket.last_flow_check_at || now,
      now,
      now
    )

    // Create audit log
    const auditLogId = generateUserId()
    db.prepare(
      'INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      auditLogId,
      ticketId,
      'flow_transition',
      verification.userId,
      'user',
      JSON.stringify({ from_status_id: ticket.status_id, transition: 'next' }),
      JSON.stringify({ to_status_id: nextFlowConfig.status_id }),
      now
    )

    // Clear current agent session
    db.prepare('UPDATE tickets SET current_agent_session_id = NULL WHERE id = ?').run(ticketId)

    // Trigger next agent if auto mode
    if (shouldAutoTriggerNext) {
      await triggerAgentForFlowStart({
        ticketId,
        workspaceId,
        userId: verification.userId!,
        sessionToken: sessionId
      })
    }

    // Trigger waiting tickets
    try {
      await triggerWaitingTickets(workspaceId)
    } catch (err) {
      logger.error({ category: logCategories.API_TICKETS }, 'triggerWaitingTickets failed:', { error: err })
    }

    logger.info(
      { category: logCategories.API_TICKETS },
      'Ticket advanced to next flow stage (session-scoped)',
      { ticketId, fromStatus: currentStatus.name, toStatus: newStatus.name }
    )

    return NextResponse.json({
      success: true,
      ticketId,
      transition: 'next',
      previousStatus: { id: currentStatus.id, name: currentStatus.name, color: currentStatus.color },
      newStatus: { id: newStatus.id, name: newStatus.name, color: newStatus.color },
      flowing_status: nextFlowingStatus,
      timestamp: now,
    })
  } catch (error) {
    logger.error({ category: logCategories.API_TICKETS }, 'Error advancing ticket (session-scoped):', { error })
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
