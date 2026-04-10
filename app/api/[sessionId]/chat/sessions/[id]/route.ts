import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import type { ChatSession } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * GET /api/{sessionId}/chat/sessions/[id]
 * Get a single chat session (session-scoped)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

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

    const session = db
      .prepare(`
        SELECT * FROM chat_sessions
        WHERE id = ? AND workspace_id = ?
      `)
      .get(id, workspaceId) as ChatSession | undefined

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session })
  } catch (error) {
    logger.error('[Chat API] Error fetching session (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat session' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/{sessionId}/chat/sessions/[id]
 * Update a chat session (session-scoped)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

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

    const body = await request.json()
    const { status, title, description, is_typing, mcp_activity } = body

    const updates: string[] = []
    const values: any[] = []

    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }

    if (title !== undefined) {
      updates.push('title = ?')
      values.push(title)
    }

    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }

    if (is_typing !== undefined) {
      updates.push('is_typing = ?')
      values.push(is_typing ? 1 : 0)
    }

    if (mcp_activity !== undefined) {
      updates.push('mcp_activity = ?')
      values.push(typeof mcp_activity === 'string' ? mcp_activity : JSON.stringify(mcp_activity))
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { message: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(id)
    values.push(workspaceId)

    const result = db.prepare(`
      UPDATE chat_sessions
      SET ${updates.join(', ')}
      WHERE id = ? AND workspace_id = ?
    `).run(...values)

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const updatedSession = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ?')
      .get(id) as ChatSession

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    logger.error('[Chat API] Error updating session (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to update chat session' },
      { status: 500 }
    )
  }
}
