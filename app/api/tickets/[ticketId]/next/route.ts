import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import {
  triggerAgentForFlowStart,
  triggerWaitingTickets,
} from '../flow/lib/trigger-agent'
import type { Ticket, Status } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'

interface RouteParams {
  params: Promise<{ ticketId: string }>
}

interface FlowConfigs {
  currentFlowConfig: any
  nextFlowConfig: any
  currentStatus: Status
  newStatus: Status
  isDoneToCompleted?: boolean
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()
    const { ticketId } = await params

    // Parse request body for finished flag
    const body = await request.json().catch(() => ({}))
    const explicitFinished = body.finished === true

    const auth = await validateAuth(request)
    if (auth.error) return auth.error

    const ticket = await getTicket(auth.db, ticketId, auth.workspaceId)
    if (ticket.error) return ticket.error

    const flowConfigs = await getFlowConfigs(auth.db, ticket.data)
    if (flowConfigs.error) return flowConfigs.error

    const now = new Date().toISOString()

    // Handle done→completed transition (terminal state)
    if (flowConfigs.isDoneToCompleted) {
      await transitionToCompleted(
        auth.db,
        ticket.data,
        flowConfigs,
        now,
        auth.user.id
      )
      logger.info(
        { category: logCategories.API_TICKETS },
        'Ticket completed via /next (done→completed runtime)',
        { ticketId }
      )
      return NextResponse.json({
        success: true,
        ticketId,
        transition: 'finished',
        previousStatus: {
          id: flowConfigs.currentStatus.id,
          name: flowConfigs.currentStatus.name,
          color: flowConfigs.currentStatus.color,
        },
        newStatus: {
          id: flowConfigs.newStatus.id,
          name: flowConfigs.newStatus.name,
          color: flowConfigs.newStatus.color,
        },
        flowing_status: 'completed',
        completedAt: now,
        timestamp: now,
      })
    }

    const { nextFlowingStatus, shouldAutoTriggerNext } =
      determineFlowTransition(ticket.data, flowConfigs, explicitFinished)

    await updateTicketStatus(
      auth.db,
      ticket.data,
      flowConfigs,
      now,
      auth.user.id,
      nextFlowingStatus
    )

    if (shouldAutoTriggerNext) {
      try {
        await triggerAgentForFlowStart({
          ticketId,
          workspaceId: auth.workspaceId,
          userId: auth.user.id,
          sessionToken: auth.sessionToken,
        })
      } catch (err) {
        logger.error(
          { category: logCategories.API_TICKETS },
          'triggerAgentForFlowStart failed in /next route:',
          { error: err }
        )
      }
    }

    try {
      await triggerWaitingTickets(auth.workspaceId)
    } catch (err) {
      logger.error(
        { category: logCategories.API_TICKETS },
        'triggerWaitingTickets failed:',
        { error: err }
      )
    }

    logger.info(
      { category: logCategories.API_TICKETS },
      'Ticket advanced to next flow stage',
      {
        ticketId,
        fromStatus: flowConfigs.currentStatus.name,
        toStatus: flowConfigs.nextFlowConfig.status_name,
      }
    )

    return NextResponse.json({
      success: true,
      ticketId,
      transition: 'next',
      previousStatus: {
        id: flowConfigs.currentStatus.id,
        name: flowConfigs.currentStatus.name,
        color: flowConfigs.currentStatus.color,
      },
      newStatus: {
        id: flowConfigs.newStatus.id,
        name: flowConfigs.newStatus.name,
        color: flowConfigs.newStatus.color,
      },
      flowing_status: nextFlowingStatus,
      timestamp: now,
    })
  } catch (error) {
    logger.error(
      { category: logCategories.API_TICKETS },
      `[POST /next] Error advancing ticket in /next route: message=${toErrorMessage(error)} stack=${toErrorStack(error)}`
    )
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function validateAuth(
  request: NextRequest
): Promise<
  | { user: { id: string }; workspaceId: string; db: any; sessionToken: string }
  | { error: NextResponse }
> {
  const urlPath =
    request.nextUrl?.pathname ??
    (() => {
      try {
        return new URL(request.url).pathname
      } catch {
        return ''
      }
    })()
  const urlMatch = urlPath.match(
    /\/([a-zA-Z0-9_-]+)_([a-zA-Z0-9_-]+)\/(finished|next)$/
  )
  const sessionTokenFromUrl = urlMatch ? urlMatch[2] : null

  const cookieStore = await cookies()
  const sessionToken =
    sessionTokenFromUrl || cookieStore.get('session_token')?.value

  if (!sessionToken)
    return {
      error: NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      ),
    }

  const user = getUserFromSession(sessionToken)
  if (!user)
    return {
      error: NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      ),
    }

  const db = getDatabase()
  const session = db
    .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
    .get(sessionToken) as { current_workspace_id: string | null } | undefined
  if (!session?.current_workspace_id)
    return {
      error: NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      ),
    }

  return { user, workspaceId: session.current_workspace_id, db, sessionToken }
}

async function getTicket(
  db: any,
  ticketId: string,
  workspaceId: string
): Promise<{ data: Ticket } | { error: NextResponse }> {
  const ticket = db
    .prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?')
    .get(ticketId, workspaceId) as Ticket | undefined
  if (!ticket)
    return {
      error: NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      ),
    }
  if (!ticket.flow_enabled)
    return {
      error: NextResponse.json(
        { message: 'Flow is not enabled for this ticket' },
        { status: 400 }
      ),
    }
  return { data: ticket }
}

async function getFlowConfigs(
  db: any,
  ticket: Ticket
): Promise<FlowConfigs | { error: NextResponse }> {
  const currentStatus = db
    .prepare('SELECT * FROM statuses WHERE id = ?')
    .get(ticket.status_id) as Status | undefined
  if (!currentStatus)
    return {
      error: NextResponse.json(
        { message: 'Current status not found' },
        { status: 400 }
      ),
    }

  if (currentStatus.name.toLowerCase() === 'completed')
    return {
      error: NextResponse.json(
        { error: 'INVALID_TRANSITION', message: 'Ticket is already completed' },
        { status: 400 }
      ),
    }

  // Handle done→completed runtime transition (terminal flow state)
  if (currentStatus.name.toLowerCase() === 'done') {
    return {
      currentFlowConfig: null,
      nextFlowConfig: null,
      currentStatus,
      newStatus: currentStatus,
      isDoneToCompleted: true,
    }
  }

  const currentFlowConfig = db
    .prepare(
      'SELECT * FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ? AND is_included = 1'
    )
    .get(ticket.id, ticket.status_id)
  if (!currentFlowConfig)
    return {
      error: NextResponse.json(
        { message: 'Current status not found in flow configuration' },
        { status: 400 }
      ),
    }

  const nextFlowConfig = db
    .prepare(
      'SELECT tfc.*, s.name as status_name, s.color as status_color FROM ticket_flow_configs tfc LEFT JOIN statuses s ON tfc.status_id = s.id WHERE tfc.ticket_id = ? AND tfc.flow_order > ? AND tfc.is_included = 1 ORDER BY tfc.flow_order ASC LIMIT 1'
    )
    .get(ticket.id, (currentFlowConfig as any).flow_order) as any
  if (!nextFlowConfig)
    return {
      error: NextResponse.json(
        {
          error: 'INVALID_TRANSITION',
          message: 'No next stage exists in the flow',
          hint: 'Use /next to complete from done status',
        },
        { status: 400 }
      ),
    }

  const newStatus = db
    .prepare('SELECT * FROM statuses WHERE id = ?')
    .get(nextFlowConfig.status_id) as Status

  return { currentFlowConfig, nextFlowConfig, currentStatus, newStatus }
}

function determineFlowTransition(
  ticket: Ticket,
  flowConfigs: FlowConfigs,
  explicitFinished?: boolean
): {
  nextFlowingStatus: 'flowing' | 'waiting'
  shouldAutoTriggerNext: boolean
} {
  // Auto-trigger if: automatic mode OR explicit finished=true signal from client
  const shouldAutoTrigger =
    (ticket.flow_mode === 'automatic' || explicitFinished) &&
    flowConfigs.nextFlowConfig.agent_id
  if (shouldAutoTrigger) {
    return { nextFlowingStatus: 'flowing', shouldAutoTriggerNext: true }
  }
  return { nextFlowingStatus: 'waiting', shouldAutoTriggerNext: false }
}

async function updateTicketStatus(
  db: any,
  ticket: Ticket,
  flowConfigs: FlowConfigs,
  now: string,
  userId: string,
  nextFlowingStatus: 'flowing' | 'waiting'
): Promise<void> {
  db.prepare(
    'UPDATE tickets SET status_id = ?, flowing_status = ?, last_flow_check_at = ?, updated_at = ? WHERE id = ?'
  ).run(
    flowConfigs.nextFlowConfig.status_id,
    nextFlowingStatus,
    now,
    now,
    ticket.id
  )

  const flowHistoryId = generateUserId()
  db.prepare(
    'INSERT INTO ticket_flow_history (id, ticket_id, from_status_id, to_status_id, agent_id, session_id, flow_result, notes, started_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    flowHistoryId,
    ticket.id,
    ticket.status_id,
    flowConfigs.nextFlowConfig.status_id,
    flowConfigs.currentFlowConfig.agent_id,
    ticket.current_agent_session_id,
    'next',
    null,
    ticket.last_flow_check_at || now,
    now,
    now
  )

  const auditLogId = generateUserId()
  db.prepare(
    'INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    auditLogId,
    ticket.id,
    'flow_transition',
    userId,
    'user',
    JSON.stringify({ from_status_id: ticket.status_id, transition: 'next' }),
    JSON.stringify({ to_status_id: flowConfigs.nextFlowConfig.status_id }),
    now
  )

  db.prepare(
    'UPDATE tickets SET current_agent_session_id = NULL WHERE id = ?'
  ).run(ticket.id)
}

async function transitionToCompleted(
  db: any,
  ticket: Ticket,
  flowConfigs: FlowConfigs,
  now: string,
  userId: string
): Promise<void> {
  // Keep status_id unchanged; mark runtime flow as completed
  try {
    db.prepare(
      'UPDATE tickets SET flowing_status = ?, completed_at = ?, last_flow_check_at = ?, updated_at = ? WHERE id = ?'
    ).run('completed', now, now, now, ticket.id)
  } catch (error) {
    logger.error(
      { category: logCategories.API_TICKETS },
      `[transitionToCompleted:updateTicket] Failed: ticketId=${ticket.id} toFlowingStatus=completed preserveStatusId=${flowConfigs.currentStatus.id} message=${toErrorMessage(error)} stack=${toErrorStack(error)}`
    )
    throw error
  }

  // Create flow history entry
  const flowHistoryId = generateUserId()
  try {
    db.prepare(
      'INSERT INTO ticket_flow_history (id, ticket_id, from_status_id, to_status_id, agent_id, session_id, flow_result, notes, started_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      flowHistoryId,
      ticket.id,
      ticket.status_id,
      flowConfigs.newStatus.id,
      null,
      ticket.current_agent_session_id,
      'finished',
      null,
      ticket.last_flow_check_at || now,
      now,
      now
    )
  } catch (error) {
    logger.error(
      { category: logCategories.API_TICKETS },
      `[transitionToCompleted:insertFlowHistory] Failed: ticketId=${ticket.id} fromStatusId=${ticket.status_id} toStatusId=${flowConfigs.newStatus.id} flowHistoryId=${flowHistoryId} message=${toErrorMessage(error)} stack=${toErrorStack(error)}`
    )
    throw error
  }

  // Create audit log
  const auditLogId = generateUserId()
  try {
    db.prepare(
      'INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      auditLogId,
      ticket.id,
      'flow_transition',
      userId,
      'user',
      JSON.stringify({
        from_status_id: ticket.status_id,
        transition: 'finished',
      }),
      JSON.stringify({
        to_status_id: flowConfigs.newStatus.id,
        completed_at: now,
      }),
      now
    )
  } catch (error) {
    logger.error(
      { category: logCategories.API_TICKETS },
      `[transitionToCompleted:insertAuditLog] Failed: ticketId=${ticket.id} auditLogId=${auditLogId} actorId=${userId} message=${toErrorMessage(error)} stack=${toErrorStack(error)}`
    )
    throw error
  }

  // Clear current agent session
  db.prepare(
    'UPDATE tickets SET current_agent_session_id = NULL WHERE id = ?'
  ).run(ticket.id)

  // Trigger waiting tickets
  try {
    await triggerWaitingTickets(ticket.workspace_id)
  } catch (err) {
    logger.error(
      { category: logCategories.API_TICKETS },
      'triggerWaitingTickets failed:',
      { error: err }
    )
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function toErrorStack(error: unknown): string {
  if (error instanceof Error && error.stack) {
    return error.stack.replace(/\n/g, ' | ')
  }
  return 'no-stack'
}
