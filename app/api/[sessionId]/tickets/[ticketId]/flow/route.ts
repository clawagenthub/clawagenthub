import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; ticketId: string }>
}

/**
 * GET /api/{sessionId}/tickets/{ticketId}/flow
 * Get current flow state for a ticket (session-scoped)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
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

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Get ticket with flow data
    const ticket = db.prepare(`
      SELECT t.*, s.name as status_name, s.color as status_color
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.id = ? AND t.workspace_id = ?
    `).get(ticketId, workspaceId) as any

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Get flow configs
    const flowConfigs = db.prepare(`
      SELECT tfc.*, s.name as status_name, s.color as status_color
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ?
      ORDER BY tfc.flow_order ASC
    `).all(ticketId) as any[]

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        title: ticket.title,
        status: {
          id: ticket.status_id,
          name: ticket.status_name,
          color: ticket.status_color
        },
        flow_enabled: ticket.flow_enabled === 1,
        flow_mode: ticket.flow_mode,
        creation_status: ticket.creation_status
      },
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
        is_included: fc.is_included === 1
      }))
    })
  } catch (error) {
    logger.error('Error fetching flow (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
