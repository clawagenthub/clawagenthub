import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Status } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"


interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/statuses/[id]
 * Update an existing status (admin/owner only)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await ensureDatabase()

    const { id } = await context.params
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
    const { name, color, description, priority, agent_id, is_flow_included, on_failed_goto, ask_approve_to_continue, skill_ids } = body

    // Validate inputs
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { message: 'Status name cannot be empty' },
          { status: 400 }
        )
      }
      if (name.length > 50) {
        return NextResponse.json(
          { message: 'Status name must be 50 characters or less' },
          { status: 400 }
        )
      }
    }

    if (color !== undefined) {
      if (typeof color !== 'string') {
        return NextResponse.json(
          { message: 'Status color must be a string' },
          { status: 400 }
        )
      }
      // Validate color format
      if (
        !color.match(/^#[0-9A-Fa-f]{6}$/) &&
        !color.match(/^[a-z]+$/) &&
        !color.match(/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/)
      ) {
        return NextResponse.json(
          { message: 'Invalid color format' },
          { status: 400 }
        )
      }
    }

    if (description !== undefined && description !== null) {
      if (description.length > 2500) {
        return NextResponse.json(
          { message: 'Description must be 2500 characters or less' },
          { status: 400 }
        )
      }
    }

    // Validate priority if provided
    if (priority !== undefined) {
      if (typeof priority !== 'number' || !Number.isInteger(priority) || priority < 0) {
        return NextResponse.json(
          { message: 'Priority must be a non-negative integer' },
          { status: 400 }
        )
      }
    }

    // Validate agent_id if provided
    if (agent_id !== undefined && agent_id !== null) {
      if (typeof agent_id !== 'string' || agent_id.trim().length === 0) {
        return NextResponse.json(
          { message: 'Agent ID must be a non-empty string or null' },
          { status: 400 }
        )
      }
    }

    const db = getDatabase()

    // Get the status and verify it exists
    const status = db
      .prepare('SELECT * FROM statuses WHERE id = ?')
      .get(id) as Status | undefined

    if (!status) {
      return NextResponse.json(
        { message: 'Status not found' },
        { status: 404 }
      )
    }

    // Check if user is owner or admin of the workspace
    const member = db
      .prepare(
        `SELECT role FROM workspace_members 
         WHERE workspace_id = ? AND user_id = ?`
      )
      .get(status.workspace_id, user.id) as
      | { role: string }
      | undefined

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json(
        { message: 'Forbidden - Only owners and admins can update statuses' },
        { status: 403 }
      )
    }

    // Check if new name already exists in this workspace (if name is being changed)
    if (name && name.trim().toLowerCase() !== status.name.toLowerCase()) {
      const existing = db
        .prepare(
          `SELECT id FROM statuses WHERE workspace_id = ? AND LOWER(name) = LOWER(?) AND id != ?`
        )
        .get(status.workspace_id, name.trim(), id)

      if (existing) {
        return NextResponse.json(
          { message: 'A status with this name already exists' },
          { status: 409 }
        )
      }
    }

    const now = new Date().toISOString()
    const updates: string[] = []
    const values: (string | null)[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name.trim())
    }
    if (color !== undefined) {
      updates.push('color = ?')
      values.push(color)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description?.trim() || null)
    }
    if (priority !== undefined) {
      updates.push('priority = ?')
      values.push(priority)
    }
    if (agent_id !== undefined) {
      updates.push('agent_id = ?')
      values.push(agent_id === null || agent_id.trim() === '' ? null : agent_id.trim())
    }
    if (is_flow_included !== undefined) {
      updates.push('is_flow_included = ?')
      values.push(is_flow_included ? 1 : 0)
    }
    if (on_failed_goto !== undefined) {
      updates.push('on_failed_goto = ?')
      values.push(on_failed_goto === null || on_failed_goto.trim() === '' ? null : on_failed_goto.trim())
    }
    if (ask_approve_to_continue !== undefined) {
      updates.push('ask_approve_to_continue = ?')
      values.push(ask_approve_to_continue ? 1 : 0)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { message: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    db.prepare(
      `UPDATE statuses SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values)

    // Handle skill_ids for status-skills association
    if (skill_ids !== undefined && Array.isArray(skill_ids)) {
      // Delete existing associations
      db.prepare('DELETE FROM status_skills WHERE status_id = ?').run(id)
      
      // Insert new associations with priority order
      if (skill_ids.length > 0) {
        const insertStmt = db.prepare(`
          INSERT INTO status_skills (status_id, skill_id, priority, created_at)
          VALUES (?, ?, ?, ?)
        `)
        
        const now = new Date().toISOString()
        for (let i = 0; i < skill_ids.length; i++) {
          insertStmt.run(id, skill_ids[i], i, now)
        }
        
        logger.info(`Updated skills for status ${id}:`, { skill_ids })
      }
    }

    const updatedStatus = db
      .prepare('SELECT * FROM statuses WHERE id = ?')
      .get(id) as Status

    return NextResponse.json({ status: updatedStatus })
  } catch (error) {
    logger.error('Error updating status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/statuses/[id]
 * Delete a status (admin/owner only)
 * If tickets are using this status, reassign them to the first available status
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await ensureDatabase()

    const { id } = await context.params
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

    // Get the status and verify it exists
    const status = db
      .prepare('SELECT * FROM statuses WHERE id = ?')
      .get(id) as Status | undefined

    if (!status) {
      return NextResponse.json(
        { message: 'Status not found' },
        { status: 404 }
      )
    }

    // Check if user is owner or admin of the workspace
    const member = db
      .prepare(
        `SELECT role FROM workspace_members 
         WHERE workspace_id = ? AND user_id = ?`
      )
      .get(status.workspace_id, user.id) as
      | { role: string }
      | undefined

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json(
        { message: 'Forbidden - Only owners and admins can delete statuses' },
        { status: 403 }
      )
    }

    // Check if any tickets are using this status
    const ticketsUsingStatus = db
      .prepare('SELECT id, title FROM tickets WHERE status_id = ?')
      .all(id) as { id: string; title: string }[]

    logger.debug(`[Status Delete] Status ${id} is used by ${ticketsUsingStatus.length} tickets`)

    if (ticketsUsingStatus.length > 0) {
      // Find a replacement status (any other status in the same workspace)
      const replacementStatus = db
        .prepare('SELECT id FROM statuses WHERE workspace_id = ? AND id != ? ORDER BY priority ASC LIMIT 1')
        .get(status.workspace_id, id) as { id: string } | undefined

      if (!replacementStatus) {
        return NextResponse.json(
          { 
            message: 'Cannot delete status - it is used by tickets and no replacement status is available',
            ticketsUsingStatus 
          },
          { status: 400 }
        )
      }

      logger.debug(`[Status Delete] Reassigning tickets to replacement status: ${replacementStatus.id}`)

      // Reassign all tickets using this status to the replacement status
      const now = new Date().toISOString()
      const reassignStmt = db.prepare('UPDATE tickets SET status_id = ?, updated_at = ? WHERE status_id = ?')
      reassignStmt.run(replacementStatus.id, now, id)
      logger.debug(`[Status Delete] Reassigned ${ticketsUsingStatus.length} tickets from status ${id} to ${replacementStatus.id}`)
    }

    // Also update flow_configs if it references this status
    const flowConfigsUsingStatus = db
      .prepare('SELECT id, ticket_id FROM ticket_flow_configs WHERE status_id = ?')
      .all(id) as { id: string; ticket_id: string }[]

    logger.debug(`[Status Delete] Found ${flowConfigsUsingStatus.length} flow_configs using status ${id}`)

    if (flowConfigsUsingStatus.length > 0) {
      // Get replacement status for flow config
      const replacementForFlow = db
        .prepare('SELECT id FROM statuses WHERE workspace_id = ? AND id != ? ORDER BY priority ASC LIMIT 1')
        .get(status.workspace_id, id) as { id: string } | undefined

      logger.debug(`[Status Delete] Replacement status for flow: ${replacementForFlow?.id}`)

      if (replacementForFlow) {
        // For each flow_config using this status, check if replacing would cause a conflict
        for (const fc of flowConfigsUsingStatus) {
          // Check if this ticket already has a flow_config with the replacement status
          const existingConfig = db
            .prepare('SELECT id FROM ticket_flow_configs WHERE ticket_id = ? AND status_id = ?')
            .get(fc.ticket_id, replacementForFlow.id)

          if (existingConfig) {
            // Conflict exists - delete the old flow_config (ticket already has one for replacement status)
            logger.debug(`[Status Delete] Conflict on ticket ${fc.ticket_id} - deleting old flow_config ${fc.id}`)
            db.prepare('DELETE FROM ticket_flow_configs WHERE id = ?').run(fc.id)
          } else {
            // No conflict - update the flow_config to use new status
            logger.debug(`[Status Delete] Updating flow_config ${fc.id} to status ${replacementForFlow.id}`)
            db.prepare('UPDATE ticket_flow_configs SET status_id = ? WHERE id = ?')
              .run(replacementForFlow.id, fc.id)
          }
        }
      }
    }

    // Delete the status
    db.prepare('DELETE FROM statuses WHERE id = ?').run(id)

    return NextResponse.json({ 
      success: true,
      reassignedTickets: ticketsUsingStatus.length
    })
  } catch (error) {
    logger.error('Error deleting status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
