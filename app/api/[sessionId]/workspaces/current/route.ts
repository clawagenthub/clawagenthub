import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/workspaces/current
 * Get the current workspace for the session (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.session) {
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

    const workspace = db
      .prepare(`
        SELECT w.*, wm.role,
               (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
        WHERE w.id = ?
      `)
      .get(verification.user?.id || verification.session.user_id, workspaceId) as any

    if (!workspace) {
      return NextResponse.json(
        { message: 'Workspace not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        owner_id: workspace.owner_id,
        role: workspace.role,
        member_count: workspace.member_count,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at
      }
    })
  } catch (error) {
    logger.error('Error fetching current workspace (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
