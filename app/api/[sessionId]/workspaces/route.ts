import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { generateUserId } from '@/lib/auth/token.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Workspace } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/workspaces
 * Get all workspaces the user is a member of (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
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

    const workspaces = db
      .prepare(`
        SELECT w.*, wm.role, (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = ?
        ORDER BY w.name
      `)
      .all(verification.user.id) as any[]

    return NextResponse.json({
      workspaces: workspaces.map(w => ({
        id: w.id,
        name: w.name,
        owner_id: w.owner_id,
        role: w.role,
        member_count: w.member_count,
        created_at: w.created_at,
        updated_at: w.updated_at
      }))
    })
  } catch (error) {
    logger.error('Error fetching workspaces (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/{sessionId}/workspaces
 * Create a new workspace (session-scoped)
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

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { message: 'Workspace name is required' },
        { status: 400 }
      )
    }

    const workspaceId = generateUserId()
    const now = new Date().toISOString()

    // Create workspace
    db.prepare(`
      INSERT INTO workspaces (id, name, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, name.trim(), verification.user.id, now, now)

    // Add creator as owner member
    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'owner', ?)
    `).run(generateUserId(), workspaceId, verification.user.id, now)

    // Create default statuses for the workspace
    const defaultStatuses = [
      { name: 'To Do', color: '#6b7280', priority: 1 },
      { name: 'In Progress', color: '#3b82f6', priority: 2 },
      { name: 'Done', color: '#22c55e', priority: 3 },
    ]

    for (const status of defaultStatuses) {
      db.prepare(`
        INSERT INTO statuses (id, name, color, workspace_id, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(generateUserId(), status.name, status.color, workspaceId, status.priority, now, now)
    }

    const workspace = db
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(workspaceId) as Workspace

    return NextResponse.json({ workspace }, { status: 201 })
  } catch (error) {
    logger.error('Error creating workspace (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
