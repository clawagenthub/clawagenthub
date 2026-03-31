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
 * POST /api/tickets/[ticketId]/flow-config/initialize
 * Initialize flow configuration from workspace defaults
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Check if flow configs already exist
    const existingConfigs = db.prepare(
      'SELECT COUNT(*) as count FROM ticket_flow_configs WHERE ticket_id = ?'
    ).get(ticketId) as { count: number }

    if (existingConfigs.count > 0) {
      // Return existing configs instead of error
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
    }

    // Get workspace statuses ordered by priority
    const statuses = db.prepare(`
      SELECT * FROM statuses
      WHERE workspace_id = ? AND is_system_status = 0
      ORDER BY priority ASC, created_at ASC
    `).all(session.current_workspace_id) as Status[]

    const now = new Date().toISOString()

    // Create flow configs from statuses
    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i]
      const configId = generateUserId()

      db.prepare(
        `INSERT INTO ticket_flow_configs (
          id, ticket_id, status_id, flow_order, agent_id, on_failed_goto,
          ask_approve_to_continue, instructions_override, is_included, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        configId,
        ticketId,
        status.id,
        i,
        status.agent_id,
        status.on_failed_goto,
        status.ask_approve_to_continue ? 1 : 0,
        status.instructions_override,
        status.is_flow_included ? 1 : 0,
        now,
        now
      )
    }

    // Get created flow configs
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
    }, { status: 201 })
  } catch (error) {
    console.error('Error initializing flow configs:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
