import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { generateUserId } from '@/lib/auth/token.js'
import { triggerWaitingTickets } from '@/lib/flow/trigger-agent'
import type { Ticket, Status } from '@/lib/db/schema'
import logger, { logCategories } from '@/lib/logger/index.js'

interface RouteParams {
  params: Promise<{ sessionId: string; ticketId: string }>
}

/**
 * POST /api/{sessionId}/tickets/[ticketId]/failed
 * Mark a ticket flow step as failed (session-scoped)
 *
 * Transitions to the status specified in on_failed_goto, or to Failed status.
 * Creates audit log entry for the transition.
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

    // Parse body for optional notes
    const body = (await request.json().catch(() => ({}))) as {
      notes?: string
    }
    const { notes } = body

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

    // Check if already failed - idempotent
    if (currentStatus.name.toLowerCase() === 'failed') {
      return NextResponse.json({
        success: true,
        ticketId,
        transition: 'failed',
        previousStatus: {
          id: currentStatus.id,
          name: currentStatus.name,
          color: currentStatus.color,
        },
        newStatus: {
          id: currentStatus.id,
          name: currentStatus.name,
          color: currentStatus.color,
        },
        flowing_status: ticket.flowing_status,
        timestamp: new Date().toISOString(),
        message: 'Ticket is already failed (idempotent response)',
      })
    }

    // Get current flow config to find on_failed_goto
    const currentFlowConfig = db
      .prepare('SELECT * FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1')
      .get(ticketId, ticket.status_id) as {
        id: string
        status_id: string
        flow_order: number
        agent_id: string | null
        on_failed_goto: string | null
        ask_approve_to_continue: boolean
      } | undefined

    let nextStatusId: string | null = null
    let nextFlowingStatus: 'failed' | 'waiting' = 'failed'

    if (currentFlowConfig?.on_failed_goto) {
      // Transition to the configured failed status
      nextStatusId = currentFlowConfig.on_failed_goto
    } else {
      // Find or create 'failed' status for this workspace
      let failedStatus = db
        .prepare('SELECT * FROM statuses WHERE workspace_id = ? AND LOWER(name) = ?')
        .get(workspaceId, 'failed') as Status | undefined

      if (!failedStatus) {
        // Create the 'failed' status
        const failedStatusId = generateUserId()
        const now = new Date().toISOString()

        // Get max priority in workspace for ordering
        const maxPriority = db
          .prepare('SELECT MAX(priority) as max_p FROM statuses WHERE workspace_id = ?')
          .get(workspaceId) as { max_p: number | null } | undefined

        const newPriority = (maxPriority?.max_p ?? 0) + 1

        db.prepare(
          `
          INSERT INTO statuses (
            id, name, color, description, workspace_id, priority,
            agent_id, on_failed_goto, is_flow_included, ask_approve_to_continue,
            instructions_override, is_system_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          failedStatusId,
          'Failed',
          '#EF4444', // Red color
          'Failed status - used when a flow step encounters an unrecoverable error',
          workspaceId,
          newPriority,
          null,
          null,
          false,
          false,
          null,
          true,
          now,
          now
        )

        failedStatus = db
          .prepare('SELECT * FROM statuses WHERE id = ?')
          .get(failedStatusId) as Status
      }

      nextStatusId = failedStatus.id
    }

    const now = new Date().toISOString()

    // Update ticket to failed status
    db.prepare(
      `
      UPDATE tickets
      SET status_id = ?,
          flowing_status = 'failed',
          current_agent_session_id = NULL,
          last_flow_check_at = ?,
          updated_at = ?
      WHERE id = ?
    `
    ).run(nextStatusId, now, now, ticketId)

    // Create flow history entry
    const flowHistoryId = generateUserId()
    db.prepare(
      `
      INSERT INTO ticket_flow_history (
        id, ticket_id, from_status_id, to_status_id, agent_id, session_id,
        flow_result, notes, started_at, completed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      flowHistoryId,
      ticketId,
      ticket.status_id,
      nextStatusId,
      currentFlowConfig?.agent_id || null,
      ticket.current_agent_session_id,
      'failed',
      notes || null,
      ticket.last_flow_check_at || now,
      now,
      now
    )

    // Create audit log
    const auditLogId = generateUserId()
    db.prepare(
      `
      INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      auditLogId,
      ticketId,
      'flow_transition',
      verification.userId,
      'user',
      JSON.stringify({ from_status_id: ticket.status_id, transition: 'failed' }),
      JSON.stringify({ to_status_id: nextStatusId }),
      now
    )

    // Clear current agent session
    db.prepare('UPDATE tickets SET current_agent_session_id = NULL WHERE id = ?').run(ticketId)

    // Get new status details
    const newStatus = db
      .prepare('SELECT * FROM statuses WHERE id = ?')
      .get(nextStatusId) as Status

    // Trigger waiting tickets
    try {
      await triggerWaitingTickets(workspaceId)
    } catch (err) {
      logger.error({ category: logCategories.API_TICKETS }, 'triggerWaitingTickets failed in /failed route:', { error: err })
    }

    logger.info(
      { category: logCategories.API_TICKETS },
      'Ticket marked as failed (session-scoped)',
      { ticketId, fromStatus: currentStatus.name, toStatus: newStatus.name, notes }
    )

    return NextResponse.json({
      success: true,
      ticketId,
      transition: 'failed',
      previousStatus: {
        id: currentStatus.id,
        name: currentStatus.name,
        color: currentStatus.color,
      },
      newStatus: {
        id: newStatus.id,
        name: newStatus.name,
        color: newStatus.color,
      },
      flowing_status: 'failed',
      timestamp: now,
    })
  } catch (error) {
    logger.error({ category: logCategories.API_TICKETS }, 'Error marking ticket as failed (session-scoped):', { error })
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}