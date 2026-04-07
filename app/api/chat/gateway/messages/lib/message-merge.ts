import type { ChatMessage } from '@/lib/db/schema'
import type { GatewayMessage, MergeResult, DeduplicationStats } from './message-types'
import {
  normalizeGatewayText,
  getGatewayRunId,
  getLocalRunId,
  parseMetadataObject,
  normalizeContentText,
  buildContentSignature,
  buildGatewayFallbackKey,
  createDeduplicationStats
} from './message-util'

/**
 * Deep merge local and gateway messages
 * 
 * Strategy:
 * 1. Add all local messages to a map (keyed by ID)
 * 2. For each gateway message, check if it exists locally
 * 3. If not exists, add it to the map with a generated ID
 * 4. Return sorted by timestamp
 */
export function mergeMessages(
  localMessages: ChatMessage[],
  gatewayMessages: GatewayMessage[],
  sessionId: string
): MergeResult {
  const mergedById = new Map<string, ChatMessage>()
  const runRoleIndex = new Set<string>()
  const runIndex = new Set<string>()
  const runToMessageId = new Map<string, string>()
  const contentSignatureIndex = new Set<string>()
  const stats = createDeduplicationStats()

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
      const parsedContent = prepareContent(gmsg)
      const metadata = prepareMetadata(gmsg, runId)

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
  const messages = Array.from(mergedById.values())
    .sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  return { messages, stats }
}

/**
 * Enrich existing local message with gateway metadata
 */
function enrichWithGatewayMetadata(
  existing: ChatMessage,
  gatewayMessage: GatewayMessage,
  runId: string | null
): ChatMessage {
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

/**
 * Prepare content JSON string from gateway message
 */
function prepareContent(gatewayMessage: GatewayMessage): string {
  const content = typeof gatewayMessage.content === 'string' 
    ? gatewayMessage.content 
    : JSON.stringify(gatewayMessage.content)
  
  try {
    if (typeof gatewayMessage.content === 'string') {
      return JSON.stringify([{ type: 'text', text: gatewayMessage.content }])
    } else {
      return JSON.stringify(gatewayMessage.content)
    }
  } catch {
    return JSON.stringify([{ type: 'text', text: String(content) }])
  }
}

/**
 * Prepare metadata JSON string from gateway message
 */
function prepareMetadata(gatewayMessage: GatewayMessage, runId: string | null): string | null {
  const baseMeta = gatewayMessage.metadata && typeof gatewayMessage.metadata === 'object' 
    ? { ...gatewayMessage.metadata } 
    : {}
    
  if (gatewayMessage.__openclaw && typeof gatewayMessage.__openclaw === 'object') {
    ;(baseMeta as any).__openclaw = {
      ...((baseMeta as any).__openclaw && typeof (baseMeta as any).__openclaw === 'object'
        ? (baseMeta as any).__openclaw
        : {}),
      ...gatewayMessage.__openclaw,
    }
  }
  if (runId && !baseMeta.runId) {
    baseMeta.runId = runId
  }
  if (!baseMeta.source) {
    baseMeta.source = 'gateway-history'
  }
  return Object.keys(baseMeta).length > 0 ? JSON.stringify(baseMeta) : null
}

/**
 * Get deduplication statistics for logging
 */
export function getStats(result: MergeResult, sessionId: string): DeduplicationStats & { sessionId: string; finalCount: number } {
  return {
    sessionId,
    ...result.stats,
    finalCount: result.messages.length,
  }
}
