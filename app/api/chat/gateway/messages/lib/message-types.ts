import type { ChatMessage } from '@/lib/db/schema'

/**
 * Result of merging local and gateway messages
 */
export interface MergeResult {
  messages: ChatMessage[]
  stats: DeduplicationStats
}

/**
 * Deduplication statistics for logging/debugging
 */
export interface DeduplicationStats {
  localAdded: number
  gatewaySeen: number
  gatewaySkippedByRunId: number
  gatewaySkippedBySignature: number
  gatewaySkippedByExactCollision: number
  gatewayAdded: number
}

/**
 * Gateway message structure (from external gateway)
 */
export interface GatewayMessage {
  id?: string
  role?: 'user' | 'assistant'
  content?: string | unknown[]
  timestamp?: string
  created_at?: string
  metadata?: Record<string, unknown>
  runId?: string
  __openclaw?: Record<string, unknown>
}

/**
 * Criteria for filtering messages
 */
export interface FilterCriteria {
  role?: 'user' | 'assistant'
  startDate?: Date
  endDate?: Date
  searchText?: string
}

/**
 * Parsed metadata object from message
 */
export interface ParsedMetadata {
  runId?: string | null
  source?: string
  __openclaw?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Signature for content deduplication
 */
export interface ContentSignature {
  role: string
  timestamp: string
  textHash: string
}
