import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateTicketId, generateUserId } from '@/lib/auth/token.js'
import type { Ticket } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'

/**
 * GET /api/tickets
 * Get all tickets for the current workspace
 */
export async function GET(request: NextRequest) {
  try {
    await ensureDatabase()

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

    const { searchParams } = new URL(request.url)
    const statusId = searchParams.get('status_id')
    const assignedTo = searchParams.get('assigned_to')
    const createdBy = searchParams.get('created_by')
    const includeDrafts = searchParams.get('include_drafts') === 'true'

    let query = `
      SELECT t.*,
             s.name as status_name, s.color as status_color,
             wt.ticket_number as waiting_finished_ticket_number,
             cb.email as created_by_email, cb.email as created_by_name,
             ub.email as assigned_to_email, ub.email as assigned_to_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN tickets wt ON t.waiting_finished_ticket_id = wt.id
      LEFT JOIN users cb ON t.created_by = cb.id
      LEFT JOIN users ub ON t.assigned_to = ub.id
      WHERE t.workspace_id = ?
    `
    const params: any[] = [session.current_workspace_id]

    // Filter out draft tickets unless explicitly requested
    if (!includeDrafts) {
      query += ' AND t.creation_status = ?'
      params.push('active')
    }

    if (statusId) {
      query += ' AND t.status_id = ?'
      params.push(statusId)
    }

    if (assignedTo) {
      query += ' AND t.assigned_to = ?'
      params.push(assignedTo)
    }

    if (createdBy) {
      query += ' AND t.created_by = ?'
      params.push(createdBy)
    }

    query += ' ORDER BY t.created_at DESC'

    const tickets = db.prepare(query).all(...params) as (Ticket & {
      status_name: string
      status_color: string
      created_by_email: string
      created_by_name: string
      waiting_finished_ticket_number: number | null
      assigned_to_email: string | null
      assigned_to_name: string | null
    })[]

    // Transform the response to include nested objects
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
      'Error fetching tickets',
      { error }
    )
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tickets
 * Create a new ticket
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDatabase()

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
      project_id,
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

    logger.info(
      { category: logCategories.API_TICKETS },
      'Create ticket payload normalized',
      {
        has_status_id: normalizedStatusId !== undefined,
        has_flow_enabled_raw:
          flow_enabled !== undefined || flowEnabled !== undefined,
        normalized_flow_enabled: normalizedFlowEnabled,
        flow_mode: normalizedFlowMode,
        flow_configs_count: Array.isArray(normalizedFlowConfigs)
          ? normalizedFlowConfigs.length
          : 0,
      }
    )

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

    // Verify status exists in workspace
    const status = db
      .prepare('SELECT id FROM statuses WHERE id = ? AND workspace_id = ?')
      .get(normalizedStatusId, session.current_workspace_id) as
      | { id: string }
      | undefined

    if (!status) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 })
    }

    // Get next ticket number for workspace
    let ticketNumber = 1
    const sequence = db
      .prepare(
        'SELECT next_ticket_number FROM workspace_ticket_sequences WHERE workspace_id = ?'
      )
      .get(session.current_workspace_id) as
      | { next_ticket_number: number }
      | undefined

    if (sequence) {
      ticketNumber = sequence.next_ticket_number
    }

    const ticketId = generateTicketId()
    const now = new Date().toISOString()

    // Create ticket
    db.prepare(
      `INSERT INTO tickets (
        id, workspace_id, ticket_number, title, description, status_id,
        created_by, assigned_to, flow_enabled, flow_mode, creation_status, created_at, updated_at,
        is_sub_ticket, parent_ticket_id, waiting_finished_ticket_id, project_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ticketId,
      session.current_workspace_id,
      ticketNumber,
      title.trim(),
      description?.trim() || null,
      normalizedStatusId,
      user.id,
      assigned_to || null,
      normalizedFlowEnabled ? 1 : 0,
      normalizedFlowMode === 'automatic' ? 'automatic' : 'manual',
      creation_status || 'active',
      now,
      now,
      isSubTicket ? 1 : 0,
      parentTicketId || null,
      waitingFinishedTicketId || null,
      project_id || null
    )

    // Update ticket sequence
    if (sequence) {
      db.prepare(
        'UPDATE workspace_ticket_sequences SET next_ticket_number = ? WHERE workspace_id = ?'
      ).run(ticketNumber + 1, session.current_workspace_id)
    } else {
      db.prepare(
        'INSERT INTO workspace_ticket_sequences (workspace_id, next_ticket_number) VALUES (?, ?)'
      ).run(session.current_workspace_id, ticketNumber + 1)
    }

    // Create audit log entry
    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticketId,
      'created',
      user.id,
      'user',
      JSON.stringify({ title, description, status_id: normalizedStatusId }),
      now
    )

    // Initialize flow configs if provided
    if (
      normalizedFlowEnabled &&
      normalizedFlowConfigs &&
      Array.isArray(normalizedFlowConfigs)
    ) {
      logger.info(
        { category: logCategories.API_TICKETS },
        'Initializing ticket flow configs',
        { ticketId, count: normalizedFlowConfigs.length }
      )

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
    } else {
      logger.info(
        { category: logCategories.API_TICKETS },
        'Skipping ticket flow config initialization',
        {
          ticketId,
          normalizedFlowEnabled,
          hasFlowConfigsArray: Array.isArray(normalizedFlowConfigs),
        }
      )
    }

    // Fetch the created ticket with related data
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
      'Error creating ticket',
      { error }
    )
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
