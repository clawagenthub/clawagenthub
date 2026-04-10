import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { generateTicketId, generateUserId } from '@/lib/auth/token.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Ticket } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'

/**
 * GET /api/{sessionId}/tickets
 * Get all tickets for the current workspace (session-scoped)
 *
 * IMPORTANT:
 * Keep session verification in handler layer via verifySession().
 * Do not move DB/session validation logic into middleware; middleware should
 * remain token-presence gating only to avoid runtime-loading failures.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // Verify session using sessionId from URL path
    const verification = verifySession({
      sessionToken: sessionId, // sessionId from URL IS the session token
      workspaceId: sessionId,
    })

    if (!verification.valid) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    await ensureDatabase()
    const db = getDatabase()

    // Use session's workspace
    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const statusId = searchParams.get('status_id')
    const assignedTo = searchParams.get('assigned_to')
    const createdBy = searchParams.get('created_by')
    const includeDrafts = searchParams.get('include_drafts') === 'true'

    let query = `
      SELECT t.*,
             s.name as status_name, s.color as status_color,
             cb.email as created_by_email, cb.email as created_by_name,
             ub.email as assigned_to_email, ub.email as assigned_to_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN users cb ON t.created_by = cb.id
      LEFT JOIN users ub ON t.assigned_to = ub.id
      WHERE t.workspace_id = ?
    `
    const params2: any[] = [workspaceId]

    if (!includeDrafts) {
      query += ' AND t.creation_status = ?'
      params2.push('active')
    }

    if (statusId) {
      query += ' AND t.status_id = ?'
      params2.push(statusId)
    }

    if (assignedTo) {
      query += ' AND t.assigned_to = ?'
      params2.push(assignedTo)
    }

    if (createdBy) {
      query += ' AND t.created_by = ?'
      params2.push(createdBy)
    }

    query += ' ORDER BY t.created_at DESC'

    const tickets = db.prepare(query).all(...params2) as (Ticket & {
      status_name: string
      status_color: string
      created_by_email: string
      created_by_name: string
      assigned_to_email: string | null
      assigned_to_name: string | null
    })[]

    const transformedTickets = tickets.map((ticket) => ({
      ...ticket,
      status: {
        id: ticket.status_id,
        name: ticket.status_name,
        color: ticket.status_color,
      },
      created_by: {
        id: ticket.created_by,
        email: ticket.created_by_email,
        name: ticket.created_by_name,
      },
      assigned_to: ticket.assigned_to
        ? {
            id: ticket.assigned_to,
            email: ticket.assigned_to_email,
            name: ticket.assigned_to_name,
          }
        : null,
    }))

    return NextResponse.json({ tickets: transformedTickets })
  } catch (error) {
    logger.error(
      { category: logCategories.API_TICKETS },
      'Error fetching tickets (session-scoped)',
      { error }
    )
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/{sessionId}/tickets
 * Create a new ticket (session-scoped)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // Verify session
    const verification = verifySession({
      sessionToken: sessionId,
      workspaceId: sessionId,
    })

    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      status_id,
      statusId,
      assigned_to,
      flow_enabled,
      flowEnabled,
      flow_configs,
      flowConfigs,
      creation_status,
      flow_mode,
      flowMode,
      isSubTicket,
      parentTicketId,
      waitingFinishedTicketId,
    } = body

    const normalizedStatusId = status_id ?? statusId
    const normalizedFlowEnabled =
      flow_enabled !== undefined
        ? Boolean(flow_enabled)
        : flowEnabled !== undefined
          ? Boolean(flowEnabled)
          : true
    const normalizedFlowMode =
      flow_mode !== undefined
        ? flow_mode
        : flowMode !== undefined
          ? flowMode
          : 'manual'
    const normalizedFlowConfigs = flow_configs ?? flowConfigs

    // Validate inputs
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { message: 'Ticket title is required' },
        { status: 400 }
      )
    }

    if (title.length > 200) {
      return NextResponse.json(
        { message: 'Title must be 200 characters or less' },
        { status: 400 }
      )
    }

    if (description && description.length > 50000) {
      return NextResponse.json(
        { message: 'Description must be 50000 characters or less' },
        { status: 400 }
      )
    }

    // Verify status exists in workspace
    const status = db
      .prepare('SELECT id FROM statuses WHERE id = ? AND workspace_id = ?')
      .get(normalizedStatusId, workspaceId) as { id: string } | undefined

    if (!status) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 })
    }

    // Get next ticket number
    let ticketNumber = 1
    const sequence = db
      .prepare(
        'SELECT next_ticket_number FROM workspace_ticket_sequences WHERE workspace_id = ?'
      )
      .get(workspaceId) as { next_ticket_number: number } | undefined

    if (sequence) {
      ticketNumber = sequence.next_ticket_number
    }

    const ticketId = generateTicketId()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO tickets (
        id, workspace_id, ticket_number, title, description, status_id,
        created_by, assigned_to, flow_enabled, flow_mode, creation_status, created_at, updated_at,
        is_sub_ticket, parent_ticket_id, waiting_finished_ticket_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ticketId,
      workspaceId,
      ticketNumber,
      title.trim(),
      description?.trim() || null,
      normalizedStatusId,
      verification.user.id,
      assigned_to || null,
      normalizedFlowEnabled ? 1 : 0,
      normalizedFlowMode === 'automatic' ? 'automatic' : 'manual',
      creation_status || 'active',
      now,
      now,
      isSubTicket ? 1 : 0,
      parentTicketId || null,
      waitingFinishedTicketId || null
    )

    // Update sequence
    if (sequence) {
      db.prepare(
        'UPDATE workspace_ticket_sequences SET next_ticket_number = ? WHERE workspace_id = ?'
      ).run(ticketNumber + 1, workspaceId)
    } else {
      db.prepare(
        'INSERT INTO workspace_ticket_sequences (workspace_id, next_ticket_number) VALUES (?, ?)'
      ).run(workspaceId, ticketNumber + 1)
    }

    // Initialize flow configs
    if (
      normalizedFlowEnabled &&
      normalizedFlowConfigs &&
      Array.isArray(normalizedFlowConfigs)
    ) {
      for (const config of normalizedFlowConfigs) {
        const configId = generateUserId()
        db.prepare(
          `INSERT INTO ticket_flow_configs (
            id, ticket_id, status_id, flow_order, agent_id, on_failed_goto,
            ask_approve_to_continue, instructions_override, is_included, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          configId,
          ticketId,
          config.status_id,
          config.flow_order,
          config.agent_id || null,
          config.on_failed_goto || null,
          config.ask_approve_to_continue ? 1 : 0,
          config.instructions_override || null,
          config.is_included !== false ? 1 : 0,
          now,
          now
        )
      }
    }

    // Fetch created ticket
    const ticket = db
      .prepare(
        `
        SELECT t.*,
               s.name as status_name, s.color as status_color,
               cb.email as created_by_email,
               ub.email as assigned_to_email
        FROM tickets t
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN users cb ON t.created_by = cb.id
        LEFT JOIN users ub ON t.assigned_to = ub.id
        WHERE t.id = ?
      `
      )
      .get(ticketId) as Ticket & {
      status_name: string
      status_color: string
      created_by_email: string
      assigned_to_email: string | null
    }

    return NextResponse.json(
      {
        ticket: {
          ...ticket,
          status: {
            id: ticket.status_id,
            name: ticket.status_name,
            color: ticket.status_color,
          },
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error(
      { category: logCategories.API_TICKETS },
      'Error creating ticket (session-scoped)',
      { error }
    )
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
