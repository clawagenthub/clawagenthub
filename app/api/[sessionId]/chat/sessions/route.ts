import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import type { ChatSession } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/chat/sessions
 * Get all chat sessions for the current workspace (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

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

    const sessions = db
      .prepare(`
        SELECT * FROM chat_sessions
        WHERE workspace_id = ?
        ORDER BY updated_at DESC
      `)
      .all(workspaceId) as ChatSession[]

    return NextResponse.json({ sessions })
  } catch (error) {
    logger.error('[Chat API] Error fetching sessions (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat sessions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/{sessionId}/chat/sessions
 * Create a new chat session (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.user) {
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
    const { gatewayId, agentId, agentName } = body

    if (!gatewayId || !agentId || !agentName) {
      return NextResponse.json(
        { error: 'Missing required fields: gatewayId, agentId, agentName' },
        { status: 400 }
      )
    }

    // Verify gateway exists and belongs to workspace
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, workspaceId) as { id: string } | undefined

    if (!gateway) {
      return NextResponse.json({ error: 'Gateway not found' }, { status: 404 })
    }

    const chatSessionId = randomUUID()
    const sessionKey = `agent:${agentId}:${chatSessionId}`
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO chat_sessions (
        id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key, status, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      chatSessionId,
      workspaceId,
      verification.user.id,
      gatewayId,
      agentId,
      agentName,
      sessionKey,
      'idle',
      now,
      now,
      now
    )

    const chatSession: ChatSession = {
      id: chatSessionId,
      workspace_id: workspaceId,
      user_id: verification.user.id,
      gateway_id: gatewayId,
      agent_id: agentId,
      agent_name: agentName,
      session_key: sessionKey,
      status: 'idle',
      last_activity_at: now,
      is_typing: 0,
      mcp_activity: null,
      title: null,
      description: null,
      created_at: now,
      updated_at: now
    }

    return NextResponse.json({ session: chatSession })
  } catch (error) {
    logger.error('[Chat API] Error creating session (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to create chat session' },
      { status: 500 }
    )
  }
}
