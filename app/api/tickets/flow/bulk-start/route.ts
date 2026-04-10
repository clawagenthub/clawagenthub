import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import logger from "@/lib/logger/index.js"


/**
 * POST /api/tickets/flow/bulk-start
 * Start flow for multiple tickets at once
 * User request: "on start all button clicked just change everything if not flowing to status waiting to flow pls"
 * 
 * Simple implementation: Set ALL eligible tickets to 'waiting_to_flow'
 * NO agent triggering, NO flow limit logic
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
    const { ticketIds } = body

    if (!ticketIds || !Array.isArray(ticketIds)) {
      return NextResponse.json(
        { message: 'Invalid payload: ticketIds must be an array' },
        { status: 400 }
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

    // Get ALL eligible tickets (flow_enabled=1, active, NOT flowing)
    const eligibleTickets = db
      .prepare(
        `
      SELECT id, title, flow_enabled, creation_status, flowing_status
      FROM tickets
      WHERE workspace_id = ?
        AND id IN (${ticketIds.map(() => '?').join(',')})
        AND flow_enabled = 1
        AND creation_status = 'active'
        AND flowing_status != 'flowing'
        AND flowing_status != 'waiting_to_flow'
    `
      )
      .all(workspaceId, ...ticketIds) as Array<{
      id: string
      title: string
      flow_enabled: number
      creation_status: string
      flowing_status: string | null
    }>


    const results = {
      total: ticketIds.length,
      eligible: eligibleTickets.length,
      updated: 0,
      details: [] as Array<{
        ticketId: string
        title: string
        status: 'waiting'
      }>,
    }

    const now = new Date().toISOString()

    // SIMPLE: Just set ALL eligible tickets to waiting_to_flow
    for (const ticket of eligibleTickets) {
      const oldStatus = ticket.flowing_status || 'stopped'

      db.prepare(
        `
        UPDATE tickets
        SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
        WHERE id = ?
      `
      ).run('waiting_to_flow', now, now, ticket.id)

      const auditLogId = generateUserId()
      db.prepare(
        `
        INSERT INTO ticket_audit_logs (
          id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        auditLogId,
        ticket.id,
        'flow_waiting',
        user.id,
        'user',
        JSON.stringify({ flowing_status: oldStatus }),
        JSON.stringify({ flowing_status: 'waiting_to_flow', reason: 'Bulk start' }),
        now
      )

      results.details.push({
        ticketId: ticket.id,
        title: ticket.title,
        status: 'waiting',
      })

      results.updated++
    }

    logger.debug(
      `[bulk-start] Updated ${results.updated} tickets to waiting_to_flow`
    )

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    logger.error('Error in bulk-start flow:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
