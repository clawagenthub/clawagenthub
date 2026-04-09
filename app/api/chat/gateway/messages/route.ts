import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import type { ChatMessage } from '@/lib/db/schema'
import { mergeMessages, getStats } from './lib/message-merge'
import logger, { logCategories } from '@/lib/logger/index.js'


/**
 * GET /api/chat/gateway/messages?sessionId=xxx
 * Pull messages from gateway and deep merge with local messages
 */
export async function GET(request: Request) {
  try {
    const sessionId = extractSessionId(request)
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    const session = fetchSession(request, sessionId, auth.workspaceId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const localMessages = fetchLocalMessages(sessionId)
    const gatewayMessages = await fetchGatewayMessages(session, request)

    const result = mergeMessages(localMessages, gatewayMessages, sessionId)
    logger.debug('[Gateway Messages] Dedupe stats', getStats(result, sessionId))

    return NextResponse.json({ messages: result.messages })
  } catch (error) {
    logger.error('[Gateway Messages] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

function extractSessionId(request: Request): string | null {
  const { searchParams } = new URL(request.url)
  return searchParams.get('sessionId')
}

function fetchSession(request: Request, sessionId: string, workspaceId: string): any {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM chat_sessions 
    WHERE id = ? AND workspace_id = ?
  `).get(sessionId, workspaceId) as any
}

function fetchLocalMessages(sessionId: string): ChatMessage[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId) as ChatMessage[]
}

async function fetchGatewayMessages(session: any, _request: Request): Promise<any[]> {
  let gatewayMessages: any[] = []
  const manager = getGatewayManager()
  const client = manager.getClient(session.gateway_id)

  if (client && client.isConnected()) {
    try {
      const history = await client.getSessionHistory(session.session_key)
      gatewayMessages = history.messages || []
      logger.debug('[Gateway Messages] Gateway messages:', gatewayMessages.length)
    } catch (error) {
      logger.error('[Gateway Messages] Failed to fetch from gateway:', error)
    }
  } else {
    logger.debug('[Gateway Messages] Gateway not connected, using local messages only')
  }

  return gatewayMessages
}
