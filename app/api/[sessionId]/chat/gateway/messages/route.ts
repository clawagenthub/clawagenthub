import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import type { ChatMessage } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/chat/gateway/messages
 * Get gateway messages (session-scoped)
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

    const { searchParams } = new URL(request.url)
    const gatewayId = searchParams.get('gateway_id')
    const sessionId2 = searchParams.get('session_id')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = `
      SELECT cm.*, cs.agent_name, cs.session_key
      FROM chat_messages cm
      JOIN chat_sessions cs ON cm.chat_session_id = cs.id
      WHERE cs.workspace_id = ?
    `
    const queryParams: any[] = [workspaceId]

    if (gatewayId) {
      query += ' AND cs.gateway_id = ?'
      queryParams.push(gatewayId)
    }

    if (sessionId2) {
      query += ' AND cm.chat_session_id = ?'
      queryParams.push(sessionId2)
    }

    query += ' ORDER BY cm.created_at DESC LIMIT ?'
    queryParams.push(limit)

    const messages = db.prepare(query).all(...queryParams) as any[]

    return NextResponse.json({ messages })
  } catch (error) {
    logger.error('[Chat API] Error fetching gateway messages (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to fetch gateway messages' },
      { status: 500 }
    )
  }
}
