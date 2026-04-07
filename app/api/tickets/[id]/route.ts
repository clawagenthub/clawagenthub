import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import type { Ticket, TicketAuditLog, TicketFlowConfig } from '@/lib/db/schema.js'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/tickets/[id]
 * Get a single ticket with audit logs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { id: ticketId } = await params
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

    // Get ticket with related data
    const ticket = db.prepare(`
      SELECT t.*, 
             s.name as status_name, s.color as status_color, s.priority as status_priority,
             cb.email as created_by_email,
             ub.email as assigned_to_email
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN users cb ON t.created_by = cb.id
      LEFT JOIN users ub ON t.assigned_to = ub.id
      WHERE t.id = ? AND t.workspace_id = ?
    `).get(ticketId, session.current_workspace_id) as (Ticket & {
      status_name: string
      status_color: string
      status_priority: number
      created_by_email: string
      assigned_to_email: string | null
    }) | undefined

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Get flow configs for this ticket
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

    // Get audit logs
    const auditLogs = db.prepare(`
      SELECT tal.*, u.email as actor_email
      FROM ticket_audit_logs tal
      LEFT JOIN users u ON tal.actor_id = u.id
      WHERE tal.ticket_id = ?
      ORDER BY tal.created_at DESC
      LIMIT 100
    `).all(ticketId) as (TicketAuditLog & {
      actor_email: string
    })[]

    return NextResponse.json({
      ticket: {
        ...ticket,
        status: {
          id: ticket.status_id,
          name: ticket.status_name,
          color: ticket.status_color,
          priority: ticket.status_priority
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
          metadata: log.metadata,
          created_at: log.created_at
        }))
      }
    })
  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/tickets/[id]
 * Update a ticket
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { id: ticketId } = await params
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
    const { title, description, status_id, assigned_to, flow_enabled, creation_status, flow_mode, isSubTicket, parentTicketId, waitingFinishedTicketId } = body

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

    // Get existing ticket
    const existingTicket = db.prepare(
      'SELECT * FROM tickets WHERE id = ? AND workspace_id = ?'
    ).get(ticketId, session.current_workspace_id) as Ticket | undefined

    if (!existingTicket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    const oldValues: Record<string, any> = {}
    const newValues: Record<string, any> = {}

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { message: 'Title is required' },
          { status: 400 }
        )
      }
      if (title.length > 200) {
        return NextResponse.json(
          { message: 'Title must be 200 characters or less' },
          { status: 400 }
        )
      }
      updates.push('title = ?')
      values.push(title.trim())
      oldValues.title = existingTicket.title
      newValues.title = title.trim()
    }

    if (description !== undefined) {
      if (description.length > 50000) {
        return NextResponse.json(
          { message: 'Description must be 50000 characters or less' },
          { status: 400 }
        )
      }
      updates.push('description = ?')
      values.push(description?.trim() || null)
      oldValues.description = existingTicket.description
      newValues.description = description?.trim() || null
    }

    if (status_id !== undefined) {
      // Verify status exists in workspace
      const status = db.prepare(
        'SELECT id FROM statuses WHERE id = ? AND workspace_id = ?'
      ).get(status_id, session.current_workspace_id)

      if (!status) {
        return NextResponse.json(
          { message: 'Invalid status' },
          { status: 400 }
        )
      }
      updates.push('status_id = ?')
      values.push(status_id)
      oldValues.status_id = existingTicket.status_id
      newValues.status_id = status_id
    }

    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?')
      values.push(assigned_to || null)
      oldValues.assigned_to = existingTicket.assigned_to
      newValues.assigned_to = assigned_to
    }

    if (flow_enabled !== undefined) {
      updates.push('flow_enabled = ?')
      values.push(flow_enabled ? 1 : 0)
      oldValues.flow_enabled = existingTicket.flow_enabled
      newValues.flow_enabled = flow_enabled
    }

    if (flow_mode !== undefined) {
      const normalizedFlowMode = flow_mode === 'automatic' ? 'automatic' : 'manual'
      updates.push('flow_mode = ?')
      values.push(normalizedFlowMode)
      oldValues.flow_mode = existingTicket.flow_mode || 'manual'
      newValues.flow_mode = normalizedFlowMode
    }

    if (creation_status !== undefined) {
      updates.push('creation_status = ?')
      values.push(creation_status)
      oldValues.creation_status = existingTicket.creation_status || 'active'
      newValues.creation_status = creation_status
    }

    if (isSubTicket !== undefined) {
      updates.push('is_sub_ticket = ?')
      values.push(isSubTicket ? 1 : 0)
      oldValues.is_sub_ticket = existingTicket.is_sub_ticket
      newValues.is_sub_ticket = isSubTicket ? 1 : 0
    }

    if (parentTicketId !== undefined) {
      updates.push('parent_ticket_id = ?')
      values.push(parentTicketId || null)
      oldValues.parent_ticket_id = existingTicket.parent_ticket_id
      newValues.parent_ticket_id = parentTicketId
    }

    if (waitingFinishedTicketId !== undefined) {
      updates.push('waiting_finished_ticket_id = ?')
      values.push(waitingFinishedTicketId || null)
      oldValues.waiting_finished_ticket_id = existingTicket.waiting_finished_ticket_id
      newValues.waiting_finished_ticket_id = waitingFinishedTicketId
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { message: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(ticketId)

    db.prepare(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values)

    // Create audit log entries
    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticketId,
      'updated',
      user.id,
      'user',
      JSON.stringify(oldValues),
      JSON.stringify(newValues),
      new Date().toISOString()
    )

    // If status changed, add status_changed audit log
    if (status_id !== undefined && status_id !== existingTicket.status_id) {
      const statusLogId = generateUserId()
      db.prepare(
        `INSERT INTO ticket_audit_logs (
          id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        statusLogId,
        ticketId,
        'status_changed',
        user.id,
        'user',
        JSON.stringify({ status_id: existingTicket.status_id }),
        JSON.stringify({ status_id }),
        new Date().toISOString()
      )
    }

    // Get updated ticket
    const updatedTicket = db.prepare(`
      SELECT t.*, 
             s.name as status_name, s.color as status_color,
             cb.email as created_by_email,
             ub.email as assigned_to_email
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN users cb ON t.created_by = cb.id
      LEFT JOIN users ub ON t.assigned_to = ub.id
      WHERE t.id = ?
    `).get(ticketId) as Ticket & {
      status_name: string
      status_color: string
      created_by_email: string
      assigned_to_email: string | null
    }

    return NextResponse.json({
      ticket: {
        ...updatedTicket,
        status: {
          id: updatedTicket.status_id,
          name: updatedTicket.status_name,
          color: updatedTicket.status_color
        }
      }
    })
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tickets/[id]
 * Delete a ticket
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { id: ticketId } = await params
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

    // Check if ticket exists and belongs to workspace
    const ticket = db.prepare(
      'SELECT id FROM tickets WHERE id = ? AND workspace_id = ?'
    ).get(ticketId, session.current_workspace_id) as { id: string } | undefined

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Delete ticket (cascade will delete related records)
    db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting ticket:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
