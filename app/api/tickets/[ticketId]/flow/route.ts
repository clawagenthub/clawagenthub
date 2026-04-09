import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware'
import { getUserFromSession } from '@/lib/auth/session'
import { getDatabase } from '@/lib/db/index'
import { triggerAgentForFlowStart } from './lib/trigger-agent'
import { processFlowPost } from './lib/process-post'
import type { Ticket } from '@/lib/db/schema'
import logger, { logCategories } from '@/lib/logger/index.js'


interface RouteParams {
  params: Promise<{ ticketId: string }>
}

/**
 * GET /api/tickets/[ticketId]/flow
 * Get flow status and next status for a ticket
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
    const workspaceId = session.current_workspace_id

    const ticket = db
      .prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?')
      .get(ticketId, workspaceId) as Ticket | undefined

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    }

    const currentFlowConfig = db
      .prepare(
        `
      SELECT tfc.*, s.name as status_name, s.color as status_color
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ? AND tfc.status_id = ?
    `
      )
      .get(ticketId, ticket.status_id) as
      | {
          id: string
          status_id: string
          status_name: string
          status_color: string
          flow_order: number
          agent_id: string | null
          on_failed_goto: string | null
          ask_approve_to_continue: boolean
          is_included: boolean
        }
      | undefined

    const nextFlowConfig = db
      .prepare(
        `
      SELECT tfc.*, s.name as status_name, s.color as status_color
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ? AND tfc.flow_order > ? AND tfc.is_included = 1
      ORDER BY tfc.flow_order ASC
      LIMIT 1
    `
      )
      .get(ticketId, currentFlowConfig?.flow_order ?? -1) as
      | {
          id: string
          status_id: string
          status_name: string
          status_color: string
          flow_order: number
          agent_id: string | null
          on_failed_goto: string | null
          ask_approve_to_continue: boolean
        }
      | undefined

    const agentSession = db
      .prepare(
        `
      SELECT * FROM chat_sessions WHERE id = ?
    `
      )
      .get(ticket.current_agent_session_id) as
      | {
          id: string
          agent_id: string
          agent_name: string
          last_activity_at: string
          status: string
        }
      | undefined

    return NextResponse.json({
      flow_enabled: ticket.flow_enabled,
      flowing_status: ticket.flowing_status || 'stopped',
      current_status: currentFlowConfig
        ? {
            id: currentFlowConfig.status_id,
            name: currentFlowConfig.status_name,
            color: currentFlowConfig.status_color,
            agent_id: currentFlowConfig.agent_id,
            on_failed_goto: currentFlowConfig.on_failed_goto,
            ask_approve_to_continue: currentFlowConfig.ask_approve_to_continue,
          }
        : null,
      next_status: nextFlowConfig
        ? {
            id: nextFlowConfig.status_id,
            name: nextFlowConfig.status_name,
            color: nextFlowConfig.status_color,
            agent_id: nextFlowConfig.agent_id,
            on_failed_goto: nextFlowConfig.on_failed_goto,
            ask_approve_to_continue: nextFlowConfig.ask_approve_to_continue,
          }
        : null,
      active_session: agentSession
        ? {
            id: agentSession.id,
            agent_id: agentSession.agent_id,
            agent_name: agentSession.agent_name,
            last_activity_at: agentSession.last_activity_at,
            status: agentSession.status,
          }
        : null,
    })
  } catch (error) {
    logger.error('Error fetching flow status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tickets/[ticketId]/flow
 * Advance flow to next status or mark as failed
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

    const body = (await request.json().catch(() => ({}))) as {
      action?: 'start' | 'stop' | 'pause'
      result?: 'finished' | 'failed' | 'pause'
      notes?: string
    }

    if (
      body.action &&
      body.action !== 'start' &&
      body.action !== 'stop' &&
      body.action !== 'pause'
    ) {
      return NextResponse.json(
        { message: 'Invalid action. Must be "start", "stop", or "pause"' },
        { status: 400 }
      )
    }

    if (
      !body.action &&
      body.result !== 'finished' &&
      body.result !== 'failed' &&
      body.result !== 'pause'
    ) {
      return NextResponse.json(
        {
          message:
            'Invalid payload. Provide action=start|stop|pause or result=finished|failed|pause',
        },
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

    const ticket = db
      .prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?')
      .get(ticketId, workspaceId) as Ticket | undefined

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    }

    if (!ticket.flow_enabled) {
      return NextResponse.json(
        { message: 'Flow is not enabled for this ticket' },
        { status: 400 }
      )
    }

    if (body.action === 'start') {
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

      if (onflowlimit > 0 && currentFlowingCount.count >= onflowlimit) {
        const now = new Date().toISOString()
        db.prepare(
          `UPDATE tickets
           SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
           WHERE id = ?`
        ).run('waiting_to_flow', now, now, ticketId)

        return NextResponse.json({
          success: true,
          action: 'start',
          flowing_status: 'waiting_to_flow',
          message: `Ticket queued - max concurrent flowing tickets (${onflowlimit}) reached`,
        })
      }

      const now = new Date().toISOString()
      db.prepare(
        `UPDATE tickets
         SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
         WHERE id = ?`
      ).run('flowing', now, now, ticketId)

      triggerAgentForFlowStart({
        ticketId,
        workspaceId,
        userId: user.id,
        sessionToken,
      })

      return NextResponse.json({
        success: true,
        action: 'start',
        flowing_status: 'flowing',
      })
    }

    if (body.action === 'stop') {
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE tickets
         SET flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ?
         WHERE id = ?`
      ).run('stopped', now, now, ticketId)

      return NextResponse.json({
        success: true,
        action: 'stop',
        flowing_status: 'stopped',
      })
    }

    if (body.action === 'pause') {
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE tickets
         SET flowing_status = ?, current_agent_session_id = NULL, last_flow_check_at = ?, updated_at = ?
         WHERE id = ?`
      ).run('waiting', now, now, ticketId)

      return NextResponse.json({
        success: true,
        action: 'pause',
        flowing_status: 'waiting',
      })
    }

    return processFlowPost(
      request,
      ticketId,
      workspaceId,
      user,
      sessionToken,
      body
    )
  } catch (error) {
    logger.error('Error updating flow:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
