import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { seedDefaultStatuses } from '@/lib/db/seeder.js'
import type { Status } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"


/**
 * GET /api/statuses
 * Get all statuses for the current workspace
 */
export async function GET(request: NextRequest) {
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

    // Get all statuses for the workspace, ordered by priority (lower numbers first)
    // For equal priorities, fall back to creation date
    const statuses = db
      .prepare(
        `SELECT * FROM statuses WHERE workspace_id = ? ORDER BY priority ASC, created_at ASC`
      )
      .all(session.current_workspace_id) as Status[]

    return NextResponse.json({ statuses })
  } catch (error) {
    logger.error('Error fetching statuses:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/statuses
 * Create a new status (admin/owner only)
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
    const {
      name,
      color,
      description,
      priority,
      agent_id,
      is_flow_included,
      on_failed_goto,
      ask_approve_to_continue,
      end_flow_completed_toggle,
    } = body

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { message: 'Status name is required' },
        { status: 400 }
      )
    }

    if (name.length > 50) {
      return NextResponse.json(
        { message: 'Status name must be 50 characters or less' },
        { status: 400 }
      )
    }

    if (!color || typeof color !== 'string') {
      return NextResponse.json(
        { message: 'Status color is required' },
        { status: 400 }
      )
    }

    // Validate color format (hex or CSS color)
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

    if (description && description.length > 2500) {
      return NextResponse.json(
        { message: 'Description must be 2500 characters or less' },
        { status: 400 }
      )
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

    // Get user's current workspace and verify permissions
    const session = db
      .prepare(
        `SELECT current_workspace_id FROM sessions WHERE token = ?`
      )
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Check if user is owner or admin
    const member = db
      .prepare(
        `SELECT role FROM workspace_members 
         WHERE workspace_id = ? AND user_id = ?`
      )
      .get(session.current_workspace_id, user.id) as
      | { role: string }
      | undefined

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json(
        { message: 'Forbidden - Only owners and admins can create statuses' },
        { status: 403 }
      )
    }

    // Check if status name already exists in this workspace
    const existing = db
      .prepare(
        `SELECT id FROM statuses WHERE workspace_id = ? AND LOWER(name) = LOWER(?)`
      )
      .get(session.current_workspace_id, name.trim())

    if (existing) {
      return NextResponse.json(
        { message: 'A status with this name already exists' },
        { status: 409 }
      )
    }

    const statusId = generateUserId()
    const now = new Date().toISOString()

    // Create status (default priority to 999 if not provided, agent_id defaults to null)
    const statusPriority = priority !== undefined ? priority : 999
    const statusAgentId = (agent_id !== undefined && agent_id !== null && agent_id.trim()) ? agent_id.trim() : null
    const statusIsFlowIncluded = is_flow_included ? 1 : 0
    const statusOnFailedGoto = (on_failed_goto !== undefined && on_failed_goto !== null && on_failed_goto.trim()) ? on_failed_goto.trim() : null
    const statusAskApproveToContinue = ask_approve_to_continue ? 1 : 0
    const statusEndFlowCompletedToggle = end_flow_completed_toggle ? 1 : 0

    db.prepare(
      `INSERT INTO statuses (id, name, color, description, workspace_id, priority, agent_id, is_flow_included, on_failed_goto, ask_approve_to_continue, end_flow_completed_toggle, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      statusId,
      name.trim(),
      color,
      description?.trim() || null,
      session.current_workspace_id,
      statusPriority,
      statusAgentId,
      statusIsFlowIncluded,
      statusOnFailedGoto,
      statusAskApproveToContinue,
      statusEndFlowCompletedToggle,
      now,
      now
    )

    const status = db
      .prepare('SELECT * FROM statuses WHERE id = ?')
      .get(statusId) as Status

    return NextResponse.json({ status }, { status: 201 })
  } catch (error) {
    logger.error('Error creating status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
