import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import type { Ticket, TicketAuditLog, TicketComment, TicketFlowConfig } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; ticketId: string }>
}

/**
 * GET /api/{sessionId}/tickets/{ticketId}/flow/view
 * Get full ticket flow view with all related data (session-scoped)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, ticketId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
      workspaceId: sessionId
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

    // Get ticket with related data
    const ticket = db.prepare(`
      SELECT t.*,
             s.name as status_name, s.color as status_color,
             cb.email as created_by_email,
             ub.email as assigned_to_email
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN users cb ON t.created_by = cb.id
      LEFT JOIN users ub ON t.assigned_to = ub.id
      WHERE t.id = ? AND t.workspace_id = ?
    `).get(ticketId, workspaceId) as (Ticket & {
      status_name: string
      status_color: string
      created_by_email: string
      assigned_to_email: string | null
    }) | undefined

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
    `).all(ticketId) as (TicketFlowConfig & {
      status_name: string
      status_color: string
    })[]

    // Get comments
    const comments = db.prepare(`
      SELECT tc.*, u.email as author_email
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.ticket_id = ?
      ORDER BY tc.created_at ASC
    `).all(ticketId) as (TicketComment & { author_email: string })[]

    // Get audit logs
    const auditLogs = db.prepare(`
      SELECT tal.*, u.email as actor_email
      FROM ticket_audit_logs tal
      LEFT JOIN users u ON tal.actor_id = u.id
      WHERE tal.ticket_id = ?
      ORDER BY tal.created_at DESC
      LIMIT 100
    `).all(ticketId) as (TicketAuditLog & { actor_email: string })[]

    return NextResponse.json({
      ticket: {
        ...ticket,
        status: {
          id: ticket.status_id,
          name: ticket.status_name,
          color: ticket.status_color
        },
        created_by: {
          id: ticket.created_by,
          email: ticket.created_by_email
        },
        assigned_to: ticket.assigned_to ? {
          id: ticket.assigned_to,
          email: ticket.assigned_to_email
        } : null,
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
      },
      comments: comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        is_agent_completion_signal: comment.is_agent_completion_signal === 1,
        created_at: comment.created_at,
        author: {
          id: comment.user_id,
          email: comment.author_email
        }
      })),
      audit_logs: auditLogs.map(log => ({
        id: log.id,
        event_type: log.event_type,
        actor: {
          id: log.actor_id,
          type: log.actor_type,
          email: log.actor_type === 'user' ? log.actor_email : null
        },
        old_value: log.old_value,
        new_value: log.new_value,
        created_at: log.created_at
      }))
    })
  } catch (error) {
    logger.error('Error fetching flow view (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
