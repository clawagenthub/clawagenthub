import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Workspace } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'


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
      .get(workspaceId, user.id)

    if (!membership) {
      return NextResponse.json(
        { message: 'Access denied - You are not a member of this workspace' },
        { status: 403 }
      )
    }

    // Update session with new workspace
    db.prepare(
      `UPDATE sessions SET current_workspace_id = ? WHERE token = ?`
    ).run(workspaceId, sessionToken)

    const workspace = db
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(workspaceId) as Workspace

    return NextResponse.json({
      success: true,
      workspace,
    })
  } catch (error) {
    logger.error('Error switching workspace:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
