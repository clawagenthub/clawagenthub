import type {
  ChatMessage,
  GatewayMessage,
  DeduplicationStats,
  ParsedMetadata
} from './message-types'

/**
 * Normalize gateway message text content to a plain string
 */
export function normalizeGatewayText(message: GatewayMessage): string {
  if (typeof message?.content === 'string') return message.content
  if (Array.isArray(message?.content)) {
    return message.content
      .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
      .map((block: any) => block.text)
      .join('\n')
  }
  return ''
}

/**
 * Get runId from gateway message (checks multiple possible locations)
 */
export function getGatewayRunId(message: GatewayMessage): string | null {
  return (
    message?.runId ??
    message?.metadata?.runId ??
    message?.__openclaw?.runId ??
    message?.__openclaw?.meta?.runId ??
    null
  )
}

/**
 * Get runId from local ChatMessage metadata
 */
export function getLocalRunId(message: ChatMessage): string | null {
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

/**
 * Parse metadata object from raw metadata (string or object)
 */
export function parseMetadataObject(raw: unknown): ParsedMetadata {
  try {
    if (!raw) return {}
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    }
    return raw && typeof raw === 'object' ? (raw as ParsedMetadata) : {}
  } catch {
    return {}
  }
}

/**
 * Normalize content text (unwrap JSON strings if needed)
 */
export function normalizeContentText(content: unknown): string {
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

/**
 * Build content signature for deduplication
 */
export function buildContentSignature(
  role: string,
  timestamp: string,
  content: unknown
): string {
  const normalizedRole = role || 'assistant'
  const normalizedTimestamp = timestamp || '0'
  const normalizedText = normalizeContentText(typeof content === 'string' ? content : JSON.stringify(content))
  return `${normalizedRole}:${normalizedTimestamp}:${normalizedText}`
}

/**
 * Build fallback key for gateway messages without stable ID
 */
export function buildGatewayFallbackKey(message: GatewayMessage): string {
  const runId = getGatewayRunId(message)
  if (runId) {
    return `gw-run:${runId}`
  }

  const role = message?.role ?? 'assistant'
  const timestamp = message?.timestamp ?? message?.created_at ?? '0'
  const text = normalizeGatewayText(message).trim()
  return `gw:${role}:${timestamp}:${text.slice(0, 120)}`
}

/**
 * Initialize deduplication stats
 */
export function createDeduplicationStats(): DeduplicationStats {
  return {
    localAdded: 0,
    gatewaySeen: 0,
    gatewaySkippedByRunId: 0,
    gatewaySkippedBySignature: 0,
    gatewaySkippedByExactCollision: 0,
    gatewayAdded: 0,
  }
}
