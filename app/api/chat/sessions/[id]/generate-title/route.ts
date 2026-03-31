import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import { getGatewayManager } from '@/lib/gateway/manager'

type AnyRecord = Record<string, unknown>

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null
}

function describeShape(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `string(len=${value.length})`
  if (typeof value === 'number' || typeof value === 'boolean') return typeof value
  if (Array.isArray(value)) return `array(len=${value.length})`
  if (isRecord(value)) return `object(keys=${Object.keys(value).join(',') || 'none'})`
  return typeof value
}

function stripCodeFences(input: string): string {
  const trimmed = input.trim()
  const fenced = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/)
  return fenced?.[1]?.trim() || trimmed
}

function collectTextParts(value: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 6 || value === null || value === undefined) return []
  if (typeof value === 'string') return [value]
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (Array.isArray(value)) return value.flatMap((item) => collectTextParts(item, seen, depth + 1))
  if (!isRecord(value)) return []
  if (seen.has(value)) return []
  seen.add(value)

  if (value.type === 'text' && typeof value.text === 'string') {
    return [value.text]
  }

  const priorityKeys = ['content', 'text', 'message', 'output', 'result', 'payload', 'data']
  const prioritized: string[] = []
  for (const key of priorityKeys) {
    if (key in value) {
      prioritized.push(...collectTextParts(value[key], seen, depth + 1))
    }
  }
  if (prioritized.length > 0) return prioritized

  return Object.values(value).flatMap((child) => collectTextParts(child, seen, depth + 1))
}

function parseTitleResponse(
  response: unknown,
  fallbackTitle: string
): {
  title: string
  source: 'response.message' | 'response' | 'none'
  mode: 'json' | 'labeled' | 'line' | 'fallback'
  rawText: string
} {
  const rawMessageText = isRecord(response) && 'message' in response
    ? collectTextParts(response.message).join('\n').trim()
    : ''
  const rawResponseText = collectTextParts(response).join('\n').trim()
  const source = rawMessageText ? 'response.message' : rawResponseText ? 'response' : 'none'
  const rawText = stripCodeFences(rawMessageText || rawResponseText)

  let title = (fallbackTitle || 'New Chat').slice(0, 100)

  const parseCandidates: string[] = []
  if (rawText) parseCandidates.push(rawText)

  const fencedJson = rawText.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/)
  if (fencedJson?.[1]) parseCandidates.push(fencedJson[1].trim())

  const firstBrace = rawText.indexOf('{')
  const lastBrace = rawText.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    parseCandidates.push(rawText.slice(firstBrace, lastBrace + 1).trim())
  }

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate) as AnyRecord
      if (typeof parsed.title === 'string' && parsed.title.trim()) {
        title = parsed.title.trim().slice(0, 100)
        return { title, source, mode: 'json', rawText }
      }
    } catch {
      // try next
    }
  }

  const titleMatch = rawText.match(/^\s*(?:title|summary)\s*:\s*(.+)$/im)
  if (titleMatch?.[1]?.trim()) {
    title = titleMatch[1].trim().slice(0, 100)
    return { title, source, mode: 'labeled', rawText }
  }

  const firstLine = rawText.split('\n').map((line) => line.trim()).find(Boolean)
  if (firstLine) {
    title = firstLine.slice(0, 100)
    return { title, source, mode: 'line', rawText }
  }

  return { title, source, mode: 'fallback', rawText }
}

/**
 * POST /api/chat/sessions/[id]/generate-title
 * Auto-generate session title using librarian agent
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase()
    const manager = getGatewayManager()

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    const sessionId = params.id

    // Verify session exists and belongs to workspace
    const session = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(sessionId, auth.workspaceId) as {
      id: string
      gateway_id: string
      agent_id: string
      title: string | null
      session_key: string
    } | undefined

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get session history from gateway
    let history: unknown = null
    try {
      const client = manager.getClient(session.gateway_id)
      if (client) {
        history = await client.getSessionHistory(session.session_key)
      }
    } catch (error) {
      console.error('Error fetching session history:', error)
    }

    if (!history || (Array.isArray(history) && history.length === 0)) {
      return NextResponse.json({
        error: 'No messages to generate title from'
      }, { status: 400 })
    }

    // Find the librarian agent (typically named 'librarian' or 'lib')
    const gateways = db
      .prepare(`SELECT * FROM gateways WHERE workspace_id = ? AND status = 'connected'`)
      .all(auth.workspaceId) as Array<{ id: string; name: string }>

    let librarianAgent: { gatewayId: string; agentId: string; agentName: string } | null = null

    for (const gateway of gateways) {
      try {
        const client = manager.getClient(gateway.id)
        if (!client || !client.isConnected()) continue

        const agents = await client.listAgents()
        const librarian = agents.find((a: any) => 
          a.name?.toLowerCase().includes('librarian') || 
          a.id?.toLowerCase().includes('librarian') ||
          a.name?.toLowerCase().includes('lib') ||
          a.id?.toLowerCase().includes('lib')
        )

        if (librarian) {
          librarianAgent = {
            gatewayId: gateway.id,
            agentId: librarian.id,
            agentName: librarian.name || librarian.id
          }
          break
        }
      } catch (error) {
        console.error('Error finding librarian agent:', error)
      }
    }

    if (!librarianAgent) {
      // Fallback: generate a simple title from the first user message
      const messages = Array.isArray(history) ? history : []
      const firstUserMessage = messages.find((msg: any) => msg.role === 'user')
      
      if (firstUserMessage) {
        const content = typeof firstUserMessage.content === 'string' 
          ? firstUserMessage.content 
          : JSON.stringify(firstUserMessage.content)
        
        // Generate a simple title (first 50 chars of the message)
        const simpleTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '')
        
        // Update the session with this title
        db.prepare(`
          UPDATE chat_sessions 
          SET title = ?, updated_at = ?
          WHERE id = ?
        `).run(simpleTitle, new Date().toISOString(), sessionId)

        return NextResponse.json({ title: simpleTitle, method: 'fallback' })
      }

      return NextResponse.json({
        error: 'No librarian agent found and no messages to generate title from'
      }, { status: 400 })
    }

    // Use librarian agent to generate a title
    const librarianClient = manager.getClient(librarianAgent.gatewayId)
    if (!librarianClient) {
      return NextResponse.json({ error: 'Librarian agent not available' }, { status: 500 })
    }

    // Ask librarian to generate a title based on session history
    const prompt = `Based on the following chat session history, generate a short, descriptive title (maximum 5 words) that summarizes the conversation. Return ONLY the title, nothing else.

Session history:
${JSON.stringify(history, null, 2)}`

    try {
      // Use chat.send with agent session key format for OpenClaw v3.2
      const agentSessionKey = `agent:${librarianAgent.agentId}:main`
      const response = await librarianClient.sendChatMessageAndWait(
        agentSessionKey,
        prompt
      ) as any
      
      if (response.error) {
        throw new Error(response.error)
      }

      const parsedTitle = parseTitleResponse(response, session.title || 'New Chat')
      const generatedTitle = parsedTitle.title

      console.log('[GenerateTitle] Parsed response', {
        sessionId,
        responseShape: describeShape(response),
        source: parsedTitle.source,
        mode: parsedTitle.mode,
        rawLength: parsedTitle.rawText.length,
        rawPreview: parsedTitle.rawText.slice(0, 180),
      })

      // Update the session with the generated title
      db.prepare(`
        UPDATE chat_sessions 
        SET title = ?, updated_at = ?
        WHERE id = ?
      `).run(generatedTitle, new Date().toISOString(), sessionId)

      return NextResponse.json({ title: generatedTitle, method: 'librarian' })
    } catch (error) {
      console.error('Error generating title with librarian:', error)
      
      // Fallback to simple title generation
      const messages = Array.isArray(history) ? history : []
      const firstUserMessage = messages.find((msg: any) => msg.role === 'user')
      
      if (firstUserMessage) {
        const content = typeof firstUserMessage.content === 'string' 
          ? firstUserMessage.content 
          : JSON.stringify(firstUserMessage.content)
        
        const simpleTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '')
        
        db.prepare(`
          UPDATE chat_sessions 
          SET title = ?, updated_at = ?
          WHERE id = ?
        `).run(simpleTitle, new Date().toISOString(), sessionId)

        return NextResponse.json({ title: simpleTitle, method: 'fallback' })
      }

      return NextResponse.json({
        error: 'Failed to generate title'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[API /api/chat/sessions] Error generating title:', error)
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    )
  }
}
