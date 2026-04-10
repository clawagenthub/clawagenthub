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

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextParts(item, seen, depth + 1))
  }

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

  const source = rawMessageText
    ? 'response.message'
    : rawResponseText
      ? 'response'
      : 'none'

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
 * POST /api/{sessionId}/chat/sessions/[id]/summarize
 * Generate a summary of the chat session using the user's selected summarizer agent (session-scoped)
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
    const requestStartedAt = Date.now()

    logger.debug('[Summarize] Request received', { chatSessionId, userId: verification.userId, workspaceId })

    // Verify session exists and belongs to workspace
    const session = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(chatSessionId, workspaceId) as {
      id: string
      gateway_id: string
      agent_id: string
      agent_name: string
      title: string | null
      description: string | null
      session_key: string
    } | undefined

    if (!session) {
      logger.warn('[Summarize] Session not found', { chatSessionId, workspaceId })
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get user's summarizer preferences
    const userSettings = db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .get(verification.userId) as {
      summarizer_agent_id: string | null
      summarizer_gateway_id: string | null
      auto_summary_enabled: number
    } | undefined

    if (!userSettings?.summarizer_agent_id || !userSettings?.summarizer_gateway_id) {
      logger.warn('[Summarize] Missing summarizer config', {
        chatSessionId,
        hasAgent: !!userSettings?.summarizer_agent_id,
        hasGateway: !!userSettings?.summarizer_gateway_id,
      })
      return NextResponse.json({
        error: 'No summarizer agent configured. Please select one in Settings.'
      }, { status: 400 })
    }

    // Get session history from gateway
    let messages: any[] | null = null
    try {
      const client = manager.getClient(session.gateway_id)
      if (client) {
        logger.debug('[Summarize] Fetching history for session:', {
          chatSessionId: session.id,
          sessionKey: session.session_key,
          gatewayId: session.gateway_id
        })
        const history = await client.getSessionHistory(session.session_key)
        logger.debug('[Summarize] History response:', history)
        messages = history.messages ?? []
        logger.debug('[Summarize] Messages extracted:', {
          count: messages.length,
          messages: messages
        })
      } else {
        logger.debug('[Summarize] No gateway client found for:', session.gateway_id)
      }
    } catch (error) {
      logger.error('[Summarize] Error fetching session history:', error)
    }

    if (!messages || messages.length === 0) {
      logger.debug('[Summarize] Returning error: No messages to summarize')
      return NextResponse.json({
        error: 'No messages to summarize'
      }, { status: 400 })
    }

    // Use the user's selected summarizer agent
    const summarizerClient = manager.getClient(userSettings.summarizer_gateway_id)
    if (!summarizerClient || !summarizerClient.isConnected()) {
      logger.warn('[Summarize] Summarizer gateway unavailable', {
        chatSessionId,
        summarizerGatewayId: userSettings.summarizer_gateway_id,
        hasClient: !!summarizerClient,
        isConnected: !!summarizerClient?.isConnected(),
      })
      return NextResponse.json({
        error: 'Summarizer agent gateway is not connected'
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
      // Use chat.send with agent session key format for OpenClaw v3.2
      const agentSessionKey = `agent:${userSettings.summarizer_agent_id}:main`
      logger.debug('[Summarize] Sending summarize prompt', {
        chatSessionId,
        agentSessionKey,
        messageCount: messages.length,
      })
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

      logger.debug('[Summarize] Parsed response', {
        chatSessionId,
        responseShape: describeShape(response),
        source: parsedSummary.source,
        mode: parsedSummary.mode,
        rawLength: parsedSummary.rawText.length,
        rawPreview: parsedSummary.rawText.slice(0, 180),
      })

      // Update the session with generated title and description
      db.prepare(`
        UPDATE chat_sessions 
        SET title = ?, description = ?, updated_at = ?
        WHERE id = ?
      `).run(generatedTitle, generatedDescription, new Date().toISOString(), chatSessionId)

      logger.debug('[Summarize] Summary updated', {
        chatSessionId,
        generatedTitle,
        durationMs: Date.now() - requestStartedAt,
      })

      return NextResponse.json({
        title: generatedTitle,
        description: generatedDescription,
        sessionId: chatSessionId
      })
    } catch (error) {
      logger.error('[Summarize] Error generating summary with summarizer agent:', {
        chatSessionId,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json({
        error: 'Failed to generate summary'
      }, { status: 500 })
    }

  } catch (error) {
    logger.error('[Summarize] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}
