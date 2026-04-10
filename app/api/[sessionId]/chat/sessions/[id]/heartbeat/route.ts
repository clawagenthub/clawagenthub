import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { getWebSocketManager } from '@/lib/websocket/manager'
import type { SessionStatus } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * POST /api/{sessionId}/chat/sessions/[id]/heartbeat
 * Update session activity timestamp and mark as active (session-scoped)
 * Called by client when user is actively interacting with the chat
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id: chatSessionId } = await params

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

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    logger.debug('[Heartbeat API] Received heartbeat for session:', chatSessionId)
    
    await ensureDatabase()
    const db = getDatabase()

    // Verify chat session belongs to user's workspace
    const session = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(chatSessionId, workspaceId) as {
        id: string
        status: SessionStatus
      } | undefined

    if (!session) {
      logger.error('[Heartbeat API] Session not found:', chatSessionId)
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    logger.debug('[Heartbeat API] Current session status:', session.status)

    const now = new Date().toISOString()

    // Update session: mark as active and update last_activity_at
    const result = db.prepare(`
      UPDATE chat_sessions
      SET status = 'active', last_activity_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, chatSessionId)

    logger.debug('[Heartbeat API] Updated session to active, changes:', result.changes)

    // Broadcast status update via WebSocket
    const manager = getWebSocketManager()
    manager.broadcast(chatSessionId, {
      type: 'session.status',
      sessionId: chatSessionId,
      status: 'active',
    })

    logger.debug('[Heartbeat API] Heartbeat successful for session:', chatSessionId, 'status=active')
    return NextResponse.json({
      success: true,
      status: 'active',
      last_activity_at: now
    })
  } catch (error) {
    logger.error('[Chat API] Error updating session heartbeat (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to update session heartbeat' },
      { status: 500 }
    )
  }
}
