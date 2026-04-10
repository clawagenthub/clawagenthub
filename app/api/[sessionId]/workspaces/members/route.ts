import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/workspaces/members
 * Get all members of the current workspace (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

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

    const members = db
      .prepare(`
        SELECT wm.*, u.email, u.is_superuser, u.first_password_changed, u.created_at as user_created_at
        FROM workspace_members wm
        JOIN users u ON wm.user_id = u.id
        WHERE wm.workspace_id = ?
        ORDER BY wm.role, u.email
      `)
      .all(workspaceId) as any[]

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        workspace_id: m.workspace_id,
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        user: {
          id: m.user_id,
          email: m.email,
          is_superuser: m.is_superuser === 1,
          first_password_changed: m.first_password_changed === 1,
          created_at: m.user_created_at
        }
      }))
    })
  } catch (error) {
    logger.error('Error fetching workspace members (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
