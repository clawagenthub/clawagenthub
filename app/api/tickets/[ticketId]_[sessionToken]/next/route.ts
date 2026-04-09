import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { triggerAgentForFlowStart, triggerWaitingTickets } from '../../[ticketId]/flow/lib/trigger-agent'
import type { Ticket, Status } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'

interface RouteParams {
  params: Promise<{ ticketId_sessionToken: string }>
}

/**
 * POST /api/tickets/[ticketId]_[sessionToken]/next
 * Agent callback to advance ticket to next flow stage (session token in URL path)
 * 
 * This route handles the compound URL pattern where session token is embedded
 * in the URL path: /api/tickets/{ticketId}_{sessionToken}/next
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
        { message: 'Invalid URL format - expected /api/tickets/{ticketId}_{sessionToken}/next' },
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

    // Get current flow config for this status
    const currentFlowConfig = db
      .prepare(
        `
        SELECT * FROM ticket_flow_configs
        WHERE ticket_id = ? AND status_id = ? AND is_included = 1
      `
      )
      .get(ticketId, ticket.status_id) as
      | {
          id: string
          status_id: string
          flow_order: number
          agent_id: string | null
          on_failed_goto: string | null
          ask_approve_to_continue: boolean
        }
      | undefined

    // Check if at 'done' status - cannot use /next, must use /finished
    if (currentStatus.name.toLowerCase() === 'done') {
      return NextResponse.json(
        {
          error: 'INVALID_TRANSITION',
          message:
            "Cannot advance from 'done' - use /finished to complete the ticket",
          currentStatus: currentStatus.name.toLowerCase(),
          hint: 'Call POST /finished to transition from done to completed',
        },
        { status: 400 }
      )
    }

    // Check if at 'completed' status - terminal state
    if (currentStatus.name.toLowerCase() === 'completed') {
      return NextResponse.json(
        {
          error: 'INVALID_TRANSITION',
          message: 'Ticket is already completed - this is a terminal state',
          currentStatus: currentStatus.name.toLowerCase(),
        },
        { status: 400 }
      )
    }

    if (!currentFlowConfig) {
      return NextResponse.json(
        { message: 'Current status not found in flow configuration' },
        { status: 400 }
      )
    }

    // Find next flow config (next stage in flow)
    const nextFlowConfig = db
      .prepare(
        `
        SELECT tfc.*, s.name as status_name, s.color as status_color
        FROM ticket_flow_configs tfc
        LEFT JOIN statuses s ON tfc.status_id = s.id
        WHERE tfc.ticket_id = ? AND tfc.flow_order > ? AND tfc.is_included = 1
        ORDER BY tfc.flow_order ASC
        LIMIT 1
      `
      )
      .get(ticketId, currentFlowConfig.flow_order) as
      | {
          id: string
          status_id: string
          status_name: string
          status_color: string
          flow_order: number
          agent_id: string | null
          on_failed_goto: string | null
          ask_approve_to_continue: boolean
        }
      | undefined

    if (!nextFlowConfig) {
      return NextResponse.json(
        {
          error: 'INVALID_TRANSITION',
          message: 'No next stage exists in the flow',
          currentStatus: currentStatus.name,
          hint: 'Use /finished to complete the ticket from done status',
        },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Determine new flowing status
    let nextFlowingStatus: 'flowing' | 'waiting' = 'waiting'
    let shouldAutoTriggerNext = false

    if (ticket.flow_mode === 'automatic' && nextFlowConfig.agent_id) {
      nextFlowingStatus = 'flowing'
      shouldAutoTriggerNext = true
    }

    // Update ticket to next status
    db.prepare(
      `
      UPDATE tickets
      SET status_id = ?, flowing_status = ?, last_flow_check_at = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(nextFlowConfig.status_id, nextFlowingStatus, now, now, ticketId)

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
      JSON.stringify({ from_status_id: ticket.status_id, transition: 'next' }),
      JSON.stringify({ to_status_id: nextFlowConfig.status_id }),
      now
    )

    // Clear current agent session
    db.prepare(
      'UPDATE tickets SET current_agent_session_id = NULL WHERE id = ?'
    ).run(ticketId)

    // Get the new status details
    const newStatus = db
      .prepare('SELECT * FROM statuses WHERE id = ?')
      .get(nextFlowConfig.status_id) as Status

    // Trigger next agent if automatic mode and agent is configured
    if (shouldAutoTriggerNext) {
      try {
        await triggerAgentForFlowStart({
          ticketId,
          workspaceId,
          userId: user.id,
          sessionToken,
        })
      } catch (err) {
        logger.error({ category: logCategories.API_TICKETS }, 'triggerAgentForFlowStart failed in /next route:', { error: err })
      }
    }

    // Trigger waiting tickets
    try {
      await triggerWaitingTickets(workspaceId)
    } catch (err) {
      logger.error({ category: logCategories.API_TICKETS }, 'triggerWaitingTickets failed in /next route:', { error: err })
    }

    logger.info(
      { category: logCategories.API_TICKETS },
      'Ticket advanced to next flow stage (compound URL)',
      {
        ticketId,
        fromStatus: currentStatus.name,
        toStatus: nextFlowConfig.status_name,
        flowMode: ticket.flow_mode,
      }
    )

    return NextResponse.json({
      success: true,
      ticketId,
      transition: 'next',
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
      flowing_status: nextFlowingStatus,
      timestamp: now,
    })
  } catch (error) {
    logger.error(
      { category: logCategories.API_TICKETS },
      'Error advancing ticket to next stage (compound URL)',
      { error }
    )
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
