import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import type { WorkspaceWithRole } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"


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

    // Get current workspace from session
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session || !session.current_workspace_id) {
      return NextResponse.json({ workspace: null })
    }

    // Get workspace details with user's role
    const workspace = db
      .prepare(
        `SELECT 
          w.id,
          w.name,
          w.owner_id,
          w.created_at,
          w.updated_at,
          wm.role,
          (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count
        FROM workspaces w
        INNER JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE w.id = ? AND wm.user_id = ?`
      )
      .get(session.current_workspace_id, user.id) as WorkspaceWithRole | undefined

    return NextResponse.json({ workspace: workspace || null })
  } catch (error) {
    logger.error('Error fetching current workspace:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
