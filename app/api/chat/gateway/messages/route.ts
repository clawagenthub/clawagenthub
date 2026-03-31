import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import type { ChatMessage } from '@/lib/db/schema'

/**
 * GET /api/chat/gateway/messages?sessionId=xxx
 * Pull messages from gateway and deep merge with local messages
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    const db = getDatabase()

    // Get session info
    const session = db.prepare(`
      SELECT * FROM chat_sessions 
      WHERE id = ? AND workspace_id = ?
    `).get(sessionId, auth.workspaceId) as any

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get local messages
    const localMessages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(sessionId) as ChatMessage[]

    console.log('[Gateway Messages] Local messages:', localMessages.length)

    // Try to get messages from gateway
    let gatewayMessages: any[] = []
    const manager = getGatewayManager()
    const client = manager.getClient(session.gateway_id)

    if (client && client.isConnected()) {
      try {
        const history = await client.getSessionHistory(session.session_key)
        gatewayMessages = history.messages || []
        console.log('[Gateway Messages] Gateway messages:', gatewayMessages.length)
      } catch (error) {
        console.error('[Gateway Messages] Failed to fetch from gateway:', error)
      }
    } else {
      console.log('[Gateway Messages] Gateway not connected, using local messages only')
    }

    // Deep merge messages
    const mergedMessages = mergeMessages(localMessages, gatewayMessages, sessionId)
    console.log('[Gateway Messages] Merged messages:', mergedMessages.length)

    return NextResponse.json({ messages: mergedMessages })
  } catch (error) {
    console.error('[Gateway Messages] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

/**
 * Deep merge local and gateway messages
 * 
 * Strategy:
 * 1. Add all local messages to a map (keyed by ID)
 * 2. For each gateway message, check if it exists locally
 * 3. If not exists, add it to the map with a generated ID
 * 4. Return sorted by timestamp
 */
function mergeMessages(
  localMessages: ChatMessage[],
  gatewayMessages: any[],
  sessionId: string
): ChatMessage[] {
  const mergedById = new Map<string, ChatMessage>()
  const runRoleIndex = new Set<string>()
  const runIndex = new Set<string>()
  const runToMessageId = new Map<string, string>()
  const contentSignatureIndex = new Set<string>()
  const stats = {
    localAdded: 0,
    gatewaySeen: 0,
    gatewaySkippedByRunId: 0,
    gatewaySkippedBySignature: 0,
    gatewaySkippedByExactCollision: 0,
    gatewayAdded: 0,
  }

  const normalizeGatewayText = (message: any): string => {
    if (typeof message?.content === 'string') return message.content
    if (Array.isArray(message?.content)) {
      return message.content
        .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
        .map((block: any) => block.text)
        .join('\n')
    }
    return ''
  }

  const getGatewayRunId = (message: any): string | null => {
    return (
      message?.runId ??
      message?.metadata?.runId ??
      message?.__openclaw?.runId ??
      message?.__openclaw?.meta?.runId ??
      null
    )
  }

  const getLocalRunId = (message: ChatMessage): string | null => {
    try {
      if (!message.metadata) return null

      const meta = typeof message.metadata === 'string'
        ? JSON.parse(message.metadata)
        : message.metadata

      if (!meta || typeof meta !== 'object') return null
      return (meta as any).runId ?? null
    } catch {
      return null
    }
  }

  const parseMetadataObject = (raw: unknown): Record<string, unknown> => {
    try {
      if (!raw) return {}
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
      }
      return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  const enrichWithGatewayMetadata = (
    existing: ChatMessage,
    gatewayMessage: any,
    runId: string | null
  ): ChatMessage => {
    const existingMeta = parseMetadataObject(existing.metadata)
    const gatewayMeta = parseMetadataObject(gatewayMessage?.metadata)
    const gatewayOpenClawMeta = parseMetadataObject(gatewayMessage?.__openclaw)

    const mergedMeta: Record<string, unknown> = {
      ...existingMeta,
      ...gatewayMeta,
    }

    if (Object.keys(gatewayOpenClawMeta).length > 0) {
      mergedMeta.__openclaw = {
        ...(parseMetadataObject((existingMeta as any).__openclaw)),
        ...gatewayOpenClawMeta,
      }
    }

    if (runId && !mergedMeta.runId) {
      mergedMeta.runId = runId
    }

    if (!mergedMeta.source) {
      mergedMeta.source = 'merged-local-gateway'
    }

    return {
      ...existing,
      metadata: Object.keys(mergedMeta).length > 0 ? JSON.stringify(mergedMeta) : existing.metadata,
    }
  }

  const normalizeContentText = (content: unknown): string => {
    if (typeof content !== 'string') return ''

    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
          .map((block: any) => block.text)
          .join('\n')
          .trim()
      }
    } catch {
      // content may already be plain text
    }

    return content.trim()
  }

  const buildContentSignature = (role: string, timestamp: string, content: unknown): string => {
    const normalizedRole = role || 'assistant'
    const normalizedTimestamp = timestamp || '0'
    const normalizedText = normalizeContentText(typeof content === 'string' ? content : JSON.stringify(content))
    return `${normalizedRole}:${normalizedTimestamp}:${normalizedText}`
  }

  const buildGatewayFallbackKey = (message: any): string => {
    const runId = getGatewayRunId(message)
    if (runId) {
      return `gw-run:${runId}`
    }

    const role = message?.role ?? 'assistant'
    const timestamp = message?.timestamp ?? message?.created_at ?? '0'
    const text = normalizeGatewayText(message).trim()
    return `gw:${role}:${timestamp}:${text.slice(0, 120)}`
  }

  // Add local messages first (source of truth)
  for (const msg of localMessages) {
    mergedById.set(msg.id, msg)
    stats.localAdded++

    const runId = getLocalRunId(msg)
    if (runId) {
      runRoleIndex.add(`${msg.role}:${runId}`)
      runIndex.add(runId)
      runToMessageId.set(`${msg.role}:${runId}`, msg.id)
    }

    contentSignatureIndex.add(buildContentSignature(msg.role, msg.created_at, msg.content))
  }

  // Add gateway messages that don't exist locally
  for (const gmsg of gatewayMessages) {
    stats.gatewaySeen++
    const role = gmsg?.role === 'user' ? 'user' : 'assistant'
    const timestamp = gmsg.timestamp || new Date().toISOString()
    const content = typeof gmsg.content === 'string' ? gmsg.content : JSON.stringify(gmsg.content)
    const runId = getGatewayRunId(gmsg)

    // Local DB is source-of-truth for user messages in both WS and HTTP paths.
    // Skipping gateway user echoes prevents duplicate prompts from merge races.
    if (role === 'user') {
      stats.gatewaySkippedBySignature++
      continue
    }

    // Strict runId dedupe: if we already have any local record for this run,
    // ignore gateway copy regardless of timestamp/content shape.
    if (runId && runIndex.has(runId)) {
      const existingId = runToMessageId.get(`${role}:${runId}`)
      if (existingId) {
        const existing = mergedById.get(existingId)
        if (existing) {
          mergedById.set(existingId, enrichWithGatewayMetadata(existing, gmsg, runId))
        }
      }
      stats.gatewaySkippedByRunId++
      continue
    }

    if (runId && runRoleIndex.has(`${role}:${runId}`)) {
      const existingId = runToMessageId.get(`${role}:${runId}`)
      if (existingId) {
        const existing = mergedById.get(existingId)
        if (existing) {
          mergedById.set(existingId, enrichWithGatewayMetadata(existing, gmsg, runId))
        }
      }
      stats.gatewaySkippedByRunId++
      continue
    }

    const signature = buildContentSignature(role, timestamp, content)
    if (contentSignatureIndex.has(signature)) {
      stats.gatewaySkippedBySignature++
      continue
    }

    // Secondary dedupe for runId-less assistant entries: if identical text exists
    // within a short time window, treat it as the same final message.
    const gatewayText = normalizeGatewayText(gmsg).trim()
    if (gatewayText) {
      const gatewayTs = new Date(timestamp).getTime()
      const recentDuplicate = Array.from(mergedById.values()).find((existing) => {
        if (existing.role !== role) return false
        const existingText = normalizeContentText(existing.content)
        if (existingText !== gatewayText) return false

        const existingTs = new Date(existing.created_at).getTime()
        return Number.isFinite(gatewayTs) && Number.isFinite(existingTs)
          ? Math.abs(gatewayTs - existingTs) <= 30_000
          : true
      })

      if (recentDuplicate) {
        stats.gatewaySkippedByExactCollision++
        continue
      }
    }

    // Prefer stable server IDs; otherwise use run-aware fallback key.
    const baseKey = gmsg.id || buildGatewayFallbackKey(gmsg)

    let key = baseKey
    let suffix = 1
    while (mergedById.has(key)) {
      const existing = mergedById.get(key)!
      if (
        existing.role === role &&
        existing.created_at === timestamp &&
        normalizeContentText(existing.content) === normalizeGatewayText(gmsg)
      ) {
        key = ''
        stats.gatewaySkippedByExactCollision++
        break
      }
      key = `${baseKey}#${suffix++}`
    }

    if (key) {
      // Parse content if it's a string
      let parsedContent = content
      try {
        // If gateway returns string content, wrap it in content blocks
        if (typeof gmsg.content === 'string') {
          parsedContent = JSON.stringify([{ type: 'text', text: gmsg.content }])
        } else {
          parsedContent = JSON.stringify(gmsg.content)
        }
      } catch {
        parsedContent = JSON.stringify([{ type: 'text', text: String(content) }])
      }

      const metadata = (() => {
        const baseMeta = gmsg.metadata && typeof gmsg.metadata === 'object' ? { ...gmsg.metadata } : {}
        if (gmsg.__openclaw && typeof gmsg.__openclaw === 'object') {
          ;(baseMeta as any).__openclaw = {
            ...((baseMeta as any).__openclaw && typeof (baseMeta as any).__openclaw === 'object'
              ? (baseMeta as any).__openclaw
              : {}),
            ...gmsg.__openclaw,
          }
        }
        if (runId && !baseMeta.runId) {
          baseMeta.runId = runId
        }
        if (!baseMeta.source) {
          baseMeta.source = 'gateway-history'
        }
        return Object.keys(baseMeta).length > 0 ? JSON.stringify(baseMeta) : null
      })()

      mergedById.set(key, {
        id: key,
        session_id: sessionId,
        role,
        content: parsedContent,
        metadata,
        created_at: timestamp
      })
      stats.gatewayAdded++

      if (runId) {
        runRoleIndex.add(`${role}:${runId}`)
        runIndex.add(runId)
        runToMessageId.set(`${role}:${runId}`, key)
      }
      contentSignatureIndex.add(signature)
    }
  }

  // Sort by timestamp
  const result = Array.from(mergedById.values())
    .sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  console.log('[Gateway Messages] Dedupe stats', {
    sessionId,
    ...stats,
    finalCount: result.length,
  })

  return result
}
