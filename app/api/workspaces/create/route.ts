import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { seedDefaultStatuses } from '@/lib/db/seeder.js'
import type { Workspace } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"


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
    ).run(workspaceId, name.trim(), user.id, now, now)

    // Add user as owner member
    db.prepare(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
       VALUES (?, ?, ?, 'owner', ?)`
    ).run(memberId, workspaceId, user.id, now)

    // Seed default statuses for the new workspace
    seedDefaultStatuses(workspaceId)

    // Update session to use new workspace
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
    logger.error('Error creating workspace:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
