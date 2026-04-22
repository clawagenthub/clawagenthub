import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { generateUserId } from '@/lib/auth/token.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Status } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/statuses
 * Get all statuses for the current workspace (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

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

    const statuses = db
      .prepare(
        `SELECT * FROM statuses WHERE workspace_id = ? ORDER BY priority ASC, created_at ASC`
      )
      .all(workspaceId) as Status[]

    return NextResponse.json({ statuses })
  } catch (error) {
    logger.error('Error fetching statuses (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/{sessionId}/statuses
 * Create a new status (session-scoped, admin/owner only)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.user) {
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

    // Check if user is owner or admin
    const member = db
      .prepare(
        `SELECT role FROM workspace_members
         WHERE workspace_id = ? AND user_id = ?`
      )
      .get(workspaceId, verification.user.id) as
      | { role: string }
      | undefined

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json(
        { message: 'Forbidden - Only owners and admins can create statuses' },
        { status: 403 }
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

    // Check for duplicate name
    const existing = db
      .prepare(
        `SELECT id FROM statuses WHERE workspace_id = ? AND LOWER(name) = LOWER(?)`
      )
      .get(workspaceId, name.trim())

    if (existing) {
      return NextResponse.json(
        { message: 'A status with this name already exists' },
        { status: 409 }
      )
    }

    const statusId = generateUserId()
    const now = new Date().toISOString()
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
      workspaceId,
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
    logger.error('Error creating status (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
