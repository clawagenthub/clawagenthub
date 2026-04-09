import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { triggerAgentForFlowStart } from '../../[ticketId]/flow/lib/trigger-agent'
import logger from "@/lib/logger/index.js"


// Start first availableSlots tickets, rest go to waiting_to_flow

/**
 * POST /api/tickets/flow/bulk-start
 * Start flow for multiple tickets at once
 * Only targets flow_enabled=true AND creation_status='active' tickets
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

    const currentFlowingCount = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM tickets WHERE workspace_id = ? AND flowing_status = 'flowing'
    `
      )
      .get(workspaceId) as { count: number }

    const onflowlimitSetting = db
      .prepare(
        `
      SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = 'onflowlimit'
    `
      )
      .get(workspaceId) as { setting_value: string } | undefined

    const onflowlimit = onflowlimitSetting?.setting_value
      ? parseInt(onflowlimitSetting.setting_value)
      : 5

    // Calculate how many slots are available (excluding currently flowing tickets)
    const availableSlots = Math.max(0, onflowlimit - currentFlowingCount.count)

    logger.debug(
      '[bulk-start] onflowlimit:',
      onflowlimit,
      'currentFlowing:',
      currentFlowingCount.count,
      'availableSlots:',
      availableSlots
    )

    const eligibleTickets = db
      .prepare(
        `
      SELECT id, title, flow_enabled, creation_status, flowing_status
      FROM tickets
      WHERE workspace_id = ?
        AND id IN (${ticketIds.map(() => '?').join(',')})
        AND flow_enabled = 1
        AND creation_status = 'active'
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
      started: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{
        ticketId: string
        title: string
        status: 'started' | 'skipped' | 'failed' | 'waiting'
        error?: string
      }>,
    }

    // Start first onflowlimit tickets, rest go to waiting_to_flow
    let startedCount = 0
    for (const ticket of eligibleTickets) {
      const now = new Date().toISOString()
      const oldStatus = ticket.flowing_status || 'stopped'

      if (startedCount < availableSlots) {
        // Start this ticket - set to flowing
        db.prepare(
          `
          UPDATE tickets
          SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
          WHERE id = ?
        `
        ).run('flowing', now, now, ticket.id)

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
          'flow_started',
          user.id,
          'user',
          JSON.stringify({ flowing_status: oldStatus }),
          JSON.stringify({ flowing_status: 'flowing', reason: 'Bulk start' }),
          now
        )

        results.started++

        // Trigger the agent for this ticket - wrap in try/catch to prevent one failure from stopping all tickets
        try {
          await triggerAgentForFlowStart({
            ticketId: ticket.id,
            workspaceId,
            userId: user.id,
            sessionToken,
          })
        } catch (triggerError) {
          logger.error(`[bulk-start] triggerAgentForFlowStart failed for ticket ${ticket.id}:`, triggerError)
          // Continue processing other tickets even if this one fails to trigger
        }

        results.details.push({
          ticketId: ticket.id,
          title: ticket.title,
          status: 'started',
        })

        startedCount++
      } else {
        // Set to waiting_to_flow - cron will handle starting
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
          JSON.stringify({
            flowing_status: 'waiting_to_flow',
            reason: 'Bulk start - queued, limit reached',
          }),
          now
        )

        results.details.push({
          ticketId: ticket.id,
          title: ticket.title,
          status: 'waiting',
          error: `Ticket queued (limit ${onflowlimit} reached)`,
        })
      }
    }

    results.eligible = eligibleTickets.length

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
