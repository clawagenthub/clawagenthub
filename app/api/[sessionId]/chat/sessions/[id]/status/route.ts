import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { verifySession } from '@/lib/session/verify'
import { getWebSocketManager } from '@/lib/websocket/manager'
import type { SessionStatus } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * PATCH /api/{sessionId}/chat/sessions/[id]/status
 * Update chat session status (session-scoped)
 */
export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { sessionId, id: sessionIdParam } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabase()
    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Verify chat session belongs to user's workspace
    const chatSession = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(sessionIdParam, workspaceId) as { id: string; user_id: string } | undefined

    if (!chatSession) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    // Verify user owns the session
    if (chatSession.user_id !== verification.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const updates: Record<string, any> = {
      updated_at: now,
    }

    // Update status if provided
    if (body.status) {
      updates.status = body.status as SessionStatus
    }

    // Update typing indicator if provided
    if (typeof body.is_typing === 'boolean') {
      updates.is_typing = body.is_typing ? 1 : 0
    }

    // Update MCP activity if provided
    if (body.mcp_activity !== undefined) {
      updates.mcp_activity = body.mcp_activity ? JSON.stringify(body.mcp_activity) : null
    }

    // Update last activity timestamp
    if (body.updateActivity) {
      updates.last_activity_at = now
    }

    // Build update query
    const fields = Object.keys(updates)
    const values = Object.values(updates)
    const setClause = fields.map(f => `${f} = ?`).join(', ')

    db.prepare(`
      UPDATE chat_sessions
      SET ${setClause}
      WHERE id = ?
    `).run(...values, sessionIdParam)

    // Broadcast status update via WebSocket
    const manager = getWebSocketManager()
    manager.broadcast(sessionIdParam, {
      type: 'session.status',
      sessionId: sessionIdParam,
      status: updates.status || body.status,
    })

    // If typing status changed, broadcast it
    if (typeof body.is_typing === 'boolean') {
      if (body.is_typing) {
        manager.broadcast(sessionIdParam, {
          type: 'typing.start',
          sessionId: sessionIdParam,
          agentName: body.agentName || 'Agent',
        })
      } else {
        manager.broadcast(sessionIdParam, {
          type: 'typing.stop',
          sessionId: sessionIdParam,
        })
      }
    }

    // If MCP activity changed, broadcast it
    if (body.mcp_activity !== undefined) {
      if (body.mcp_activity) {
        manager.broadcast(sessionIdParam, {
          type: 'mcp.start',
          sessionId: sessionIdParam,
          tool: body.mcp_activity.tool,
          action: body.mcp_activity.action,
        })
      } else {
        manager.broadcast(sessionIdParam, {
          type: 'mcp.complete',
          sessionId: sessionIdParam,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Chat API] Error updating session status (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to update session status' },
      { status: 500 }
    )
  }
}
