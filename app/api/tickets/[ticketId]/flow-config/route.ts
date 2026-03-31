import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import type { TicketFlowConfig, Status } from '@/lib/db/schema.js'

interface RouteParams {
  params: Promise<{ ticketId: string }>
}

/**
 * GET /api/tickets/[ticketId]/flow-config
 * Get flow configuration for a ticket
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

    // Verify ticket exists in workspace
    const ticket = db.prepare(
      'SELECT id FROM tickets WHERE id = ? AND workspace_id = ?'
    ).get(ticketId, session.current_workspace_id) as { id: string } | undefined

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Get flow configs
    const flowConfigs = db.prepare(`
      SELECT tfc.*, s.name as status_name, s.color as status_color, 
             s.priority as default_priority, s.agent_id as default_agent_id,
             s.on_failed_goto as default_on_failed_goto,
             s.ask_approve_to_continue as default_ask_approve,
             s.is_flow_included as default_is_flow_included
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ?
      ORDER BY tfc.flow_order ASC
    `).all(ticketId) as (TicketFlowConfig & {
      status_name: string
      status_color: string
      default_priority: number
      default_agent_id: string | null
      default_on_failed_goto: string | null
      default_ask_approve_to_continue: boolean
      default_is_flow_included: boolean
    })[]

    return NextResponse.json({
      flow_configs: flowConfigs.map(fc => ({
        id: fc.id,
        status_id: fc.status_id,
        status: {
          id: fc.status_id,
          name: fc.status_name,
          color: fc.status_color,
          default_agent_id: fc.default_agent_id,
          default_on_failed_goto: fc.default_on_failed_goto,
          default_ask_approve_to_continue: fc.default_ask_approve_to_continue
        },
        flow_order: fc.flow_order,
        agent_id: fc.agent_id,
        on_failed_goto: fc.on_failed_goto,
        ask_approve_to_continue: fc.ask_approve_to_continue,
        instructions_override: fc.instructions_override,
        is_included: fc.is_included
      }))
    })
  } catch (error) {
    console.error('Error fetching flow configs:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tickets/[ticketId]/flow-config
 * Update flow configuration for a ticket
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json()
    const { configs } = body

    if (!Array.isArray(configs)) {
      return NextResponse.json(
        { message: 'configs must be an array' },
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

    // Verify ticket exists in workspace
    const ticket = db.prepare(
      'SELECT id FROM tickets WHERE id = ? AND workspace_id = ?'
    ).get(ticketId, session.current_workspace_id) as { id: string } | undefined

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()

    // Delete existing flow configs
    db.prepare('DELETE FROM ticket_flow_configs WHERE ticket_id = ?').run(ticketId)

    // Insert new flow configs
    for (const config of configs) {
      // Verify status exists in workspace
      const status = db.prepare(
        'SELECT id FROM statuses WHERE id = ? AND workspace_id = ?'
      ).get(config.status_id, session.current_workspace_id) as { id: string } | undefined

      if (!status) {
        return NextResponse.json(
          { message: `Invalid status_id: ${config.status_id}` },
          { status: 400 }
        )
      }

      const configId = config.id || generateUserId()

      db.prepare(
        `INSERT INTO ticket_flow_configs (
          id, ticket_id, status_id, flow_order, agent_id, on_failed_goto,
          ask_approve_to_continue, instructions_override, is_included, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ticket_id, status_id) DO UPDATE SET
          flow_order = excluded.flow_order,
          agent_id = excluded.agent_id,
          on_failed_goto = excluded.on_failed_goto,
          ask_approve_to_continue = excluded.ask_approve_to_continue,
          instructions_override = excluded.instructions_override,
          is_included = excluded.is_included,
          updated_at = excluded.updated_at`
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

    // Get updated flow configs
    const flowConfigs = db.prepare(`
      SELECT tfc.*, s.name as status_name, s.color as status_color
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ?
      ORDER BY tfc.flow_order ASC
    `).all(ticketId) as (TicketFlowConfig & {
      status_name: string
      status_color: string
    })[]

    return NextResponse.json({
      flow_configs: flowConfigs.map(fc => ({
        id: fc.id,
        status_id: fc.status_id,
        status: {
          id: fc.status_id,
          name: fc.status_name,
          color: fc.status_color
        },
        flow_order: fc.flow_order,
        agent_id: fc.agent_id,
        on_failed_goto: fc.on_failed_goto,
        ask_approve_to_continue: fc.ask_approve_to_continue,
        instructions_override: fc.instructions_override,
        is_included: fc.is_included
      }))
    })
  } catch (error) {
    console.error('Error updating flow configs:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
