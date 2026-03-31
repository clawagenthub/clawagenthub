import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import type { ChatSession } from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    const db = getDatabase()
    const body = await request.json()
    const { gatewayId, agentId, agentName } = body

    if (!gatewayId || !agentId || !agentName) {
      return NextResponse.json(
        { error: 'Missing required fields: gatewayId, agentId, agentName' },
        { status: 400 }
      )
    }

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    // Verify gateway exists and belongs to workspace
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, auth.workspaceId) as { id: string } | undefined

    if (!gateway) {
      return NextResponse.json({ error: 'Gateway not found' }, { status: 404 })
    }

    // Create chat session
    const chatSessionId = randomUUID()
    // Use a unique gateway session key per chat session to prevent
    // cross-session history bleed for chats that use the same agent.
    // Legacy sessions that already use :main remain readable because
    // all read/send paths use the persisted session_key from DB.
    const sessionKey = `agent:${agentId}:${chatSessionId}`
    const now = new Date().toISOString()

    console.log('[Sessions API] Inserting session with status=idle, last_activity_at=', now)
    db.prepare(`
      INSERT INTO chat_sessions (
        id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key, status, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?)
    `).run(
      chatSessionId,
      auth.workspaceId,
      auth.user.id,
      gatewayId,
      agentId,
      agentName,
      sessionKey,
      now,
      now,
      now
    )

    const chatSession: ChatSession = {
      id: chatSessionId,
      workspace_id: auth.workspaceId,
      user_id: auth.user.id,
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

    console.log('[Sessions API] Session created successfully:', chatSessionId, 'status=idle')
    return NextResponse.json({ session: chatSession })
  } catch (error) {
    console.error('[Chat API] Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create chat session' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const db = getDatabase()

    // Use global auth utility
    console.log('[Sessions API] Fetching sessions - checking auth...')
    const auth = await getUserWithWorkspace()
    if (!auth) {
      console.error('[Sessions API] Auth failed or no workspace selected')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }
    console.log('[Sessions API] Auth successful, workspaceId:', auth.workspaceId)

    // Get all chat sessions for the current workspace
    const sessions = db
      .prepare(`
        SELECT * FROM chat_sessions
        WHERE workspace_id = ?
        ORDER BY updated_at DESC
      `)
      .all(auth.workspaceId) as ChatSession[]

    // Log session statuses for debugging
    const activeCount = sessions.filter((s: ChatSession) => s.status === 'active').length
    const idleCount = sessions.filter((s: ChatSession) => s.status === 'idle').length
    const inactiveCount = sessions.filter((s: ChatSession) => s.status === 'inactive').length
    console.log(`[Sessions API] Returning ${sessions.length} sessions: ${activeCount} active, ${idleCount} idle, ${inactiveCount} inactive`)
    
    // Log each session's status for detailed debugging
    sessions.forEach((s: ChatSession) => {
      console.log(`[Sessions API] Session ${s.id.slice(0, 8)}... - status: ${s.status}, last_activity: ${s.last_activity_at}`)
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('[Chat API] Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat sessions' },
      { status: 500 }
    )
  }
}
