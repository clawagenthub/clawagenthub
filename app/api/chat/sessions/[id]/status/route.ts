import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import { getWebSocketManager } from '@/lib/websocket/manager'
import type { SessionStatus } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"


export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase()
    const sessionId = params.id
    const body = await request.json()

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    // Verify chat session belongs to user's workspace
    const chatSession = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(sessionId, auth.workspaceId) as { id: string; user_id: string } | undefined

    if (!chatSession) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    // Verify user owns the session
    if (chatSession.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const updates: any = {
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
    `).run(...values, sessionId)

    // Broadcast status update via WebSocket
    const manager = getWebSocketManager()
    manager.broadcast(sessionId, {
      type: 'session.status',
      sessionId,
      status: updates.status || body.status,
    })

    // If typing status changed, broadcast it
    if (typeof body.is_typing === 'boolean') {
      if (body.is_typing) {
        manager.broadcast(sessionId, {
          type: 'typing.start',
          sessionId,
          agentName: body.agentName || 'Agent',
        })
      } else {
        manager.broadcast(sessionId, {
          type: 'typing.stop',
          sessionId,
        })
      }
    }

    // If MCP activity changed, broadcast it
    if (body.mcp_activity !== undefined) {
      if (body.mcp_activity) {
        manager.broadcast(sessionId, {
          type: 'mcp.start',
          sessionId,
          tool: body.mcp_activity.tool,
          action: body.mcp_activity.action,
        })
      } else {
        manager.broadcast(sessionId, {
          type: 'mcp.complete',
          sessionId,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Chat API] Error updating session status:', error)
    return NextResponse.json(
      { error: 'Failed to update session status' },
      { status: 500 }
    )
  }
}
