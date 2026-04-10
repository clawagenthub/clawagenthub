import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import type { ChatMessage } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * GET /api/{sessionId}/chat/sessions/[id]/messages
 * Get messages for a chat session (session-scoped)
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

    // Verify session belongs to workspace
    const chatSession = db
      .prepare('SELECT id FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId)

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const before = searchParams.get('before')

    let query = `
      SELECT * FROM chat_messages
      WHERE chat_session_id = ?
    `
    const queryParams: any[] = [id]

    if (before) {
      query += ' AND created_at < ?'
      queryParams.push(before)
    }

    query += ' ORDER BY created_at DESC LIMIT ?'
    queryParams.push(limit)

    const messages = db.prepare(query).all(...queryParams) as ChatMessage[]

    // Reverse to get chronological order
    const chronologicalMessages = messages.reverse()

    return NextResponse.json({ messages: chronologicalMessages })
  } catch (error) {
    logger.error('[Chat API] Error fetching messages (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
