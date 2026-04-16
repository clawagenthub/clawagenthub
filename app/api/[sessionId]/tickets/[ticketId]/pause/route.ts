import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { generateUserId } from '@/lib/auth/token.js'
import { triggerWaitingTickets } from '@/app/api/tickets/[ticketId]/flow/lib/trigger-agent'
import type { Ticket, Status } from '@/lib/db/schema'
import logger, { logCategories } from '@/lib/logger/index.js'

interface RouteParams {
  params: Promise<{ sessionId: string; ticketId: string }>
}

/**
 * POST /api/{sessionId}/tickets/[ticketId]/pause
 * Pause a ticket flow (session-scoped)
 *
 * Transitions to waiting state and retains current status.
 * Used when explicit external/user input is required to continue.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { sessionId, ticketId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
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

    // Parse body for optional notes describing reason for pause
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

    // Check if already paused (waiting) - idempotent
    if (
      ticket.flowing_status === 'waiting' ||
      ticket.flowing_status === 'waiting_to_flow'
    ) {
      return NextResponse.json({
        success: true,
        ticketId,
        transition: 'pause',
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
        message: 'Ticket is already paused (idempotent response)',
      })
    }

    const now = new Date().toISOString()

    // Update ticket to waiting (paused) status - retain current status_id
    db.prepare(
      `
      UPDATE tickets
      SET flowing_status = 'waiting',
          current_agent_session_id = NULL,
          last_flow_check_at = ?,
          updated_at = ?
      WHERE id = ?
    `
    ).run(now, now, ticketId)

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
      ticket.status_id, // retain same status
      null,
      ticket.current_agent_session_id,
      'pause',
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      auditLogId,
      ticketId,
      'flow_stopped',
      verification.userId,
      'user',
      JSON.stringify({
        flowing_status: ticket.flowing_status,
        transition: 'pause',
      }),
      JSON.stringify({
        flowing_status: 'waiting',
        reason: notes || 'paused by user/agent',
      }),
      now
    )

    // Clear current agent session
    db.prepare(
      'UPDATE tickets SET current_agent_session_id = NULL WHERE id = ?'
    ).run(ticketId)

    // Trigger waiting tickets
    try {
      await triggerWaitingTickets(workspaceId)
    } catch (err) {
      logger.error(
        { category: logCategories.API_TICKETS },
        'triggerWaitingTickets failed in /pause route:',
        { error: err }
      )
    }

    logger.info(
      { category: logCategories.API_TICKETS },
      'Ticket paused (session-scoped)',
      { ticketId, status: currentStatus.name, notes }
    )

    return NextResponse.json({
      success: true,
      ticketId,
      transition: 'pause',
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
      flowing_status: 'waiting',
      timestamp: now,
    })
  } catch (error) {
    logger.error(
      { category: logCategories.API_TICKETS },
      'Error pausing ticket (session-scoped):',
      { error }
    )
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
