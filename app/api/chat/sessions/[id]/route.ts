import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import type { ChatSession } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"


/**
 * PATCH /api/chat/sessions/[id]
 * Update session title or description
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDatabase()
    const body = await request.json()
    const { title, description } = body

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    const { id: sessionId } = await params

    // Verify session exists and belongs to workspace
    const session = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(sessionId, auth.workspaceId) as { id: string } | undefined

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = []
    const values: (string | number)[] = []

    if (typeof title === 'string') {
      updates.push('title = ?')
      values.push(title)
    }

    if (typeof description === 'string') {
      updates.push('description = ?')
      values.push(description)
    } else if (description === null) {
      updates.push('description = NULL')
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update session
    updates.push('updated_at = ?')
    values.push(new Date().toISOString(), sessionId)

    db.prepare(`
      UPDATE chat_sessions
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)

    // Fetch updated session
    const updatedSession = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ?')
      .get(sessionId) as ChatSession

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    logger.error('[API /api/chat/sessions] Error updating session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}
