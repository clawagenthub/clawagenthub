import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import type { Workspace } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"


/**
 * POST /api/{sessionId}/workspaces/switch
 * Switch to a different workspace (session-scoped)
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
    const { workspaceId } = body

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { message: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    // Verify user has access to this workspace
    const membership = db
      .prepare(
        `SELECT * FROM workspace_members 
         WHERE workspace_id = ? AND user_id = ?`
      )
      .get(workspaceId, verification.userId)

    if (!membership) {
      logger.warn('[Workspace Switch] Access denied:', {
        workspaceId,
        userId: verification.userId
      })
      return NextResponse.json(
        { message: 'Access denied - You are not a member of this workspace' },
        { status: 403 }
      )
    }

    // Update session with new workspace
    db.prepare(
      `UPDATE sessions SET current_workspace_id = ? WHERE token = ?`
    ).run(workspaceId, sessionId)

    const workspace = db
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(workspaceId) as Workspace

    logger.info('[Workspace Switch] Switched workspace:', {
      workspaceId,
      userId: verification.userId
    })

    return NextResponse.json({
      success: true,
      workspace,
    })
  } catch (error) {
    logger.error('Error switching workspace (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
