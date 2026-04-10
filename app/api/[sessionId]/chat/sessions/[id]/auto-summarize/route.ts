import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import logger from "@/lib/logger/index.js"


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

function parseSummaryResponse(
  response: unknown,
  fallbackTitle: string,
  fallbackDescription: string
): {
  title: string
  description: string
  source: 'response.message' | 'response' | 'none'
  mode: 'json' | 'labeled' | 'lines' | 'fallback'
  rawText: string
} {
  const rawMessageText = isRecord(response) && 'message' in response
    ? collectTextParts(response.message).join('\n').trim()
    : ''
  const rawResponseText = collectTextParts(response).join('\n').trim()
  const source = rawMessageText ? 'response.message' : rawResponseText ? 'response' : 'none'
  const rawText = stripCodeFences(rawMessageText || rawResponseText)

  let title = (fallbackTitle || 'New Chat').slice(0, 100)
  let description = (fallbackDescription || '').slice(0, 500)

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
      }
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim().slice(0, 500)
      }
      return { title, description, source, mode: 'json', rawText }
    } catch {
      // try next candidate
    }
  }

  const titleMatch = rawText.match(/^\s*(?:title|summary)\s*:\s*(.+)$/im)
  const descriptionMatch = rawText.match(/^\s*(?:description|details?)\s*:\s*([\s\S]+)$/im)
  if (titleMatch?.[1] || descriptionMatch?.[1]) {
    if (titleMatch?.[1]?.trim()) title = titleMatch[1].trim().slice(0, 100)
    if (descriptionMatch?.[1]?.trim()) description = descriptionMatch[1].trim().slice(0, 500)
    return { title, description, source, mode: 'labeled', rawText }
  }

  const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length > 0) {
    title = lines[0].slice(0, 100)
    description = lines.slice(1).join('\n').slice(0, 500)
    return { title, description, source, mode: 'lines', rawText }
  }

  return { title, description, source, mode: 'fallback', rawText }
}

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * POST /api/{sessionId}/chat/sessions/[id]/auto-summarize
 * Automatically summarize a session that has been idle (session-scoped)
 * This endpoint:
 * 1. Verifies the user has auto-summary enabled
 * 2. Checks if the session has been idle for the configured timeout
 * 3. Calls the summarizer agent to generate title/description
 * 4. Marks the session as 'inactive' after successful summary
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id: chatSessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
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

    const db = getDatabase()
    const manager = getGatewayManager()

    // Get session with user info
    const session = db
      .prepare(`
        SELECT cs.*, us.auto_summary_enabled, us.idle_timeout_minutes, 
               us.summarizer_agent_id, us.summarizer_gateway_id
        FROM chat_sessions cs
        LEFT JOIN user_settings us ON us.user_id = cs.user_id
        WHERE cs.id = ? AND cs.workspace_id = ?
      `)
      .get(chatSessionId, workspaceId) as {
        id: string
        user_id: string
        gateway_id: string
        agent_id: string
        agent_name: string
        title: string | null
        description: string | null
        session_key: string
        status: 'active' | 'idle' | 'inactive'
        last_activity_at: string
        auto_summary_enabled: number
        idle_timeout_minutes: number
        summarizer_agent_id: string | null
        summarizer_gateway_id: string | null
      } | undefined

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if auto-summary is enabled for this user
    if (!session.auto_summary_enabled || !session.summarizer_agent_id || !session.summarizer_gateway_id) {
      return NextResponse.json({
        error: 'Auto-summary is not enabled for this user',
        skip: true
      }, { status: 400 })
    }

    // Check if session is already summarized (inactive)
    if (session.status === 'inactive') {
      return NextResponse.json({
        error: 'Session already summarized',
        skip: true
      }, { status: 400 })
    }

    // Check if session has been idle for the configured timeout
    const now = Date.now()
    const lastActivity = new Date(session.last_activity_at).getTime()
    const idleTimeoutMs = session.idle_timeout_minutes * 60 * 1000
    const idleTimeMs = now - lastActivity

    if (idleTimeMs < idleTimeoutMs) {
      return NextResponse.json({
        error: 'Session not idle long enough',
        skip: true,
        idle_minutes: Math.floor(idleTimeMs / 60000),
        required_minutes: session.idle_timeout_minutes
      }, { status: 400 })
    }

    // Get session history from gateway
    let messages: any[] | null = null
    try {
      const client = manager.getClient(session.gateway_id)
      if (client && client.isConnected()) {
        logger.debug('[AutoSummarize] Fetching history for session:', session.id)
        const history = await client.getSessionHistory(session.session_key)
        messages = history.messages ?? []
        logger.debug('[AutoSummarize] Found messages:', messages.length)
      } else {
        logger.debug('[AutoSummarize] Gateway not connected for:', session.gateway_id)
        return NextResponse.json({
          error: 'Summarizer gateway not connected',
          skip: true
        }, { status: 503 })
      }
    } catch (error) {
      logger.error('[AutoSummarize] Error fetching session history:', error)
      return NextResponse.json({
        error: 'Failed to fetch session history',
        skip: true
      }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      logger.debug('[AutoSummarize] No messages to summarize')
      return NextResponse.json({
        error: 'No messages to summarize',
        skip: true
      }, { status: 400 })
    }

    // Use the user's selected summarizer agent
    const summarizerClient = manager.getClient(session.summarizer_gateway_id)
    if (!summarizerClient || !summarizerClient.isConnected()) {
      return NextResponse.json({
        error: 'Summarizer agent gateway is not connected',
        skip: true
      }, { status: 503 })
    }

    // Ask summarizer to generate title and description
    const prompt = `Analyze the following chat session history and provide:
1. A short title (maximum 5 words) that summarizes the conversation
2. A brief description (2-3 sentences) describing what was discussed

Return your response as JSON in this exact format:
{
  "title": "Short title here",
  "description": "Brief description here"
}

Session history:
${JSON.stringify(messages, null, 2)}`

    try {
      const agentSessionKey = `agent:${session.summarizer_agent_id}:main`
      const response = await summarizerClient.sendChatMessageAndWait(
        agentSessionKey,
        prompt
      ) as any
      
      if (response.error) {
        throw new Error(response.error)
      }

      const parsedSummary = parseSummaryResponse(
        response,
        session.title || 'New Chat',
        session.description || ''
      )
      const generatedTitle = parsedSummary.title
      const generatedDescription = parsedSummary.description

      logger.debug('[AutoSummarize] Parsed response', {
        chatSessionId,
        responseShape: describeShape(response),
        source: parsedSummary.source,
        mode: parsedSummary.mode,
        rawLength: parsedSummary.rawText.length,
        rawPreview: parsedSummary.rawText.slice(0, 180),
      })

      const updatedAt = new Date().toISOString()

      // Update the session with generated title, description, and mark as inactive
      db.prepare(`
        UPDATE chat_sessions 
        SET title = ?, description = ?, status = 'inactive', updated_at = ?
        WHERE id = ?
      `).run(generatedTitle, generatedDescription, updatedAt, chatSessionId)

      logger.debug('[AutoSummarize] Summary generated and session marked as inactive:', {
        chatSessionId,
        title: generatedTitle
      })

      return NextResponse.json({
        success: true,
        title: generatedTitle,
        description: generatedDescription,
        sessionId: chatSessionId,
        status: 'inactive'
      })
    } catch (error) {
      logger.error('[AutoSummarize] Error generating summary:', error)
      return NextResponse.json({
        error: 'Failed to generate summary',
        skip: true
      }, { status: 500 })
    }

  } catch (error) {
    logger.error('[Chat API] Error in auto-summarize (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to auto-summarize session' },
      { status: 500 }
    )
  }
}
