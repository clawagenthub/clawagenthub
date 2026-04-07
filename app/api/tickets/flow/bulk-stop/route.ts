import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'

/**
 * POST /api/tickets/flow/bulk-stop
 * Stop flow for multiple tickets at once
 * Only targets flow_enabled=true AND creation_status='active' AND flowing_status='flowing' tickets
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

    const eligibleTickets = db
      .prepare(
        `
      SELECT id, title, flow_enabled, creation_status, flowing_status
      FROM tickets
      WHERE workspace_id = ?
        AND id IN (${ticketIds.map(() => '?').join(',')})
        AND flow_enabled = 1
        AND creation_status = 'active'
        AND flowing_status IN ('flowing', 'waiting_to_flow')
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
      stopped: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{
        ticketId: string
        title: string
        status: 'stopped' | 'skipped' | 'failed'
        error?: string
      }>,
    }

    const now = new Date().toISOString()

    for (const ticket of eligibleTickets) {
      // Accept both 'flowing' and 'waiting_to_flow' statuses to stop
      try {
        db.prepare(
          `
          UPDATE tickets
          SET flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ?
          WHERE id = ?
        `
        ).run('stopped', now, now, ticket.id)

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
          'flow_stopped',
          user.id,
          'user',
          JSON.stringify({
            flowing_status: ticket.flowing_status || 'stopped',
          }),
          JSON.stringify({ flowing_status: 'stopped' }),
          now
        )

        results.stopped++
        results.details.push({
          ticketId: ticket.id,
          title: ticket.title,
          status: 'stopped',
        })
      } catch (error) {
        results.failed++
        results.details.push({
          ticketId: ticket.id,
          title: ticket.title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error('Error in bulk-stop flow:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
