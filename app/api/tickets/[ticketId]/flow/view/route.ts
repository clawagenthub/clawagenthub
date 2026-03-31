import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Ticket } from '@/lib/db/schema.js'

interface RouteParams {
  params: Promise<{ ticketId: string }>
}

/**
 * GET /api/tickets/[ticketId]/flow/view
 * Agent/UI friendly full view of current ticket flow context.
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
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const ticket = db.prepare(
      `SELECT t.*, s.name as status_name, s.description as status_description, s.instructions_override as status_instructions
       FROM tickets t
       LEFT JOIN statuses s ON s.id = t.status_id
       WHERE t.id = ? AND t.workspace_id = ?`
    ).get(ticketId, session.current_workspace_id) as (Ticket & {
      status_name: string | null
      status_description: string | null
      status_instructions: string | null
    }) | undefined

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    }

    const flowConfigs = db.prepare(
      `SELECT tfc.*, s.name as status_name
       FROM ticket_flow_configs tfc
       LEFT JOIN statuses s ON s.id = tfc.status_id
       WHERE tfc.ticket_id = ?
       ORDER BY tfc.flow_order ASC`
    ).all(ticketId) as Array<{
      id: string
      status_id: string
      status_name: string | null
      flow_order: number
      agent_id: string | null
      on_failed_goto: string | null
      ask_approve_to_continue: boolean
      instructions_override: string | null
      is_included: boolean
    }>

    const comments = db.prepare(
      `SELECT tc.id, tc.content, tc.created_at, tc.updated_at, tc.is_agent_completion_signal, u.email
       FROM ticket_comments tc
       LEFT JOIN users u ON u.id = tc.created_by
       WHERE tc.ticket_id = ?
       ORDER BY tc.created_at DESC
       LIMIT 30`
    ).all(ticketId) as Array<{
      id: string
      content: string
      created_at: string
      updated_at: string
      is_agent_completion_signal: boolean
      email: string | null
    }>

    const latestHistory = db.prepare(
      `SELECT * FROM ticket_flow_history
       WHERE ticket_id = ?
       ORDER BY created_at DESC
       LIMIT 20`
    ).all(ticketId)

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        description: ticket.description,
        status_id: ticket.status_id,
        status_name: ticket.status_name,
        status_description: ticket.status_description,
        flow_enabled: ticket.flow_enabled,
        flowing_status: ticket.flowing_status,
        last_flow_check_at: ticket.last_flow_check_at,
        updated_at: ticket.updated_at,
      },
      current_status_context: {
        status_id: ticket.status_id,
        status_name: ticket.status_name,
        status_description: ticket.status_description,
        status_instructions: ticket.status_instructions,
      },
      flow_configs: flowConfigs,
      latest_comments: comments,
      flow_history: latestHistory,
      api_actions: {
        comment: `/api/tickets/${ticketId}/comments`,
        finished: `/api/tickets/${ticketId}/finished`,
        failed: `/api/tickets/${ticketId}/failed`,
      },
    })
  } catch (error) {
    console.error('Error building flow view:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

