import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import { getWebSocketManager } from '@/lib/websocket/manager'
import type { SessionStatus } from '@/lib/db/schema'

/**
 * POST /api/chat/sessions/[id]/heartbeat
 * Update session activity timestamp and mark as active
 * Called by client when user is actively interacting with the chat
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Heartbeat API] Received heartbeat for session:', params.id)
    const db = getDatabase()
    const sessionId = params.id

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      console.error('[Heartbeat API] Auth failed')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    // Verify chat session belongs to user's workspace
    const chatSession = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(sessionId, auth.workspaceId) as {
        id: string
        status: SessionStatus
      } | undefined

    if (!chatSession) {
      console.error('[Heartbeat API] Session not found:', sessionId)
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    console.log('[Heartbeat API] Current session status:', chatSession.status)

    const now = new Date().toISOString()

    // Update session: mark as active and update last_activity_at
    const result = db.prepare(`
      UPDATE chat_sessions
      SET status = 'active', last_activity_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, sessionId)

    console.log('[Heartbeat API] Updated session to active, changes:', result.changes)

    // Broadcast status update via WebSocket
    const manager = getWebSocketManager()
    manager.broadcast(sessionId, {
      type: 'session.status',
      sessionId,
      status: 'active',
    })

    console.log('[Heartbeat API] Heartbeat successful for session:', sessionId, 'status=active')
    return NextResponse.json({
      success: true,
      status: 'active',
      last_activity_at: now
    })
  } catch (error) {
    console.error('[Chat API] Error updating session heartbeat:', error)
    return NextResponse.json(
      { error: 'Failed to update session heartbeat' },
      { status: 500 }
    )
  }
}
