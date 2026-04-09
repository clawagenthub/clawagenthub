import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { triggerWaitingTickets } from '../../[ticketId]/flow/lib/trigger-agent'
import type { Ticket, Status } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'

interface RouteParams {
  params: Promise<{ ticketId_sessionToken: string }>
}

/**
 * POST /api/tickets/[ticketId]_[sessionToken]/finished
 * Agent callback to mark flow step as finished (session token in URL path)
 *
 * This route handles the compound URL pattern where session token is embedded
 * in the URL path: /api/tickets/{ticketId}_{sessionToken}/finished
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    await ensureDatabase()

    const { ticketId_sessionToken } = await context.params
    // Split only on first underscore to separate ticketId from sessionToken
    // sessionToken may contain underscores, so we use split with limit 2
    const parts = ticketId_sessionToken.split('_', 2)
    const ticketId = parts[0]
    const sessionToken = parts[1]

    if (!ticketId || !sessionToken) {
      return NextResponse.json(
        { message: 'Invalid URL format - expected /api/tickets/{ticketId}_{sessionToken}/finished' },
        { status: 400 }
      )
    }

    // Validate session from URL
    const user = getUserFromSession(sessionToken)
    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session token in URL' },
        { status: 401 }
      )
    }

    const db = getDatabase()

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

    // Check if already completed - idempotent behavior
    if (currentStatus.name.toLowerCase() === 'completed') {
      return NextResponse.json({
        success: true,
        ticketId,
        transition: 'finished',
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
        completedAt: ticket.completed_at,
        timestamp: new Date().toISOString(),
        message: 'Ticket is already completed (idempotent response)',
      })
    }

    // Only allow finishing from 'done' status
    if (currentStatus.name.toLowerCase() !== 'done') {
      return NextResponse.json(
        {
          error: 'INVALID_TRANSITION',
          message: "Can only finish from 'done' status",
          currentStatus: currentStatus.name.toLowerCase(),
          hint: 'Use /next to advance through flow stages first',
        },
        { status: 400 }
      )
    }

    // Find or create 'completed' status for this workspace
    let completedStatus = db
      .prepare(
        'SELECT * FROM statuses WHERE workspace_id = ? AND LOWER(name) = ?'
      )
      .get(workspaceId, 'completed') as Status | undefined

    if (!completedStatus) {
      // Create the 'completed' status
      const completedStatusId = generateUserId()
      const now = new Date().toISOString()

      // Get max priority in workspace for ordering
      const maxPriority = db
        .prepare(
          'SELECT MAX(priority) as max_p FROM statuses WHERE workspace_id = ?'
        )
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
        completedStatusId,
        'Completed',
        '#10B981', // Green color
        'Terminal completed status - used when a ticket is fully done',
        workspaceId,
        newPriority,
        null, // agent_id
        null, // on_failed_goto
        false, // is_flow_included - NOT part of flow
        false, // ask_approve_to_continue
        null, // instructions_override
        true, // is_system_status
        now,
        now
      )

      completedStatus = db
        .prepare('SELECT * FROM statuses WHERE id = ?')
        .get(completedStatusId) as Status
    }

    const now = new Date().toISOString()

    // Update ticket to completed status
    db.prepare(
      `
      UPDATE tickets
      SET status_id = ?,
          flowing_status = 'completed',
          completed_at = ?,
          last_flow_check_at = ?,
          updated_at = ?
      WHERE id = ?
    `
    ).run(completedStatus.id, now, now, now, ticketId)

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
      completedStatus.id,
      null, // agent_id - finishing via API, not agent
      ticket.current_agent_session_id,
      'finished',
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
      'flow_transition',
      user.id,
      'user',
      JSON.stringify({
        from_status_id: ticket.status_id,
        transition: 'finished',
      }),
      JSON.stringify({ to_status_id: completedStatus.id, completed_at: now }),
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
      logger.error({ category: logCategories.API_TICKETS }, 'triggerWaitingTickets failed in /finished route:', { error: err })
    }

    logger.info(
      { category: logCategories.API_TICKETS },
      'Ticket completed via /finished (compound URL)',
      {
        ticketId,
        fromStatus: currentStatus.name,
        toStatus: completedStatus.name,
        notes,
      }
    )

    return NextResponse.json({
      success: true,
      ticketId,
      transition: 'finished',
      previousStatus: {
        id: currentStatus.id,
        name: currentStatus.name,
        color: currentStatus.color,
      },
      newStatus: {
        id: completedStatus.id,
        name: completedStatus.name,
        color: completedStatus.color,
      },
      flowing_status: 'completed',
      completedAt: now,
      timestamp: now,
    })
  } catch (error) {
    logger.error({ category: logCategories.API_TICKETS }, 'Error completing ticket (compound URL)', {
      error,
    })
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}