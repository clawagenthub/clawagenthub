import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { generateUserId } from '@/lib/auth/token.js'
import { seedDefaultStatuses } from '@/lib/db/seeder.js'
import type { Workspace } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"


/**
 * POST /api/{sessionId}/workspaces/create
 * Create a new workspace (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    await ensureDatabase()

    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
      workspaceId: sessionId
    })

    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { message: 'Workspace name is required' },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { message: 'Workspace name must be 100 characters or less' },
        { status: 400 }
      )
    }

    const db = getDatabase()
    const workspaceId = generateUserId()
    const memberId = generateUserId()
    const now = new Date().toISOString()

    // Create workspace
    db.prepare(
      `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(workspaceId, name.trim(), verification.userId, now, now)

    // Add user as owner member
    db.prepare(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
       VALUES (?, ?, ?, 'owner', ?)`
    ).run(memberId, workspaceId, verification.userId, now)

    // Seed default statuses for the new workspace
    seedDefaultStatuses(workspaceId)

    // Update session to use new workspace
    db.prepare(
      `UPDATE sessions SET current_workspace_id = ? WHERE token = ?`
    ).run(workspaceId, sessionId)

    const workspace = db
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(workspaceId) as Workspace

    logger.info('[Workspace Create] Created new workspace:', {
      workspaceId,
      name: name.trim(),
      userId: verification.userId
    })

    return NextResponse.json({
      success: true,
      workspace,
    })
  } catch (error) {
    logger.error('Error creating workspace (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
