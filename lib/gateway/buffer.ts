/**
 * Event Buffer for Gateway Session Instances
 * 
 * Circular buffer that stores gateway events for reconnection scenarios.
 * When a client reconnects, they can request events since a specific sequence number.
 */

import type { EventFrame } from './protocol.js'

// ============================================================================
// TYPES
// ============================================================================

/** Buffered event with metadata */
export interface BufferedEvent {
  /** Sequence number */
  seq: number
  /** Event type (e.g., 'chat', 'agent') */
  event: string
  /** Event payload */
  payload: unknown
  /** Timestamp when event was buffered */
  timestamp: Date
  /** Whether this event has been acknowledged by clients */
  acknowledged: boolean
}

/** Buffer statistics */
export interface BufferStats {
  /** Current number of events in buffer */
  size: number
  /** Maximum buffer capacity */
  maxSize: number
  /** Current sequence number */
  currentSeq: number
  /** Oldest sequence number available */
  oldestSeq: number | null
  /** Total events buffered (lifetime) */
  totalBuffered: number
  /** Total events expired (lifetime) */
  totalExpired: number
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Buffer configuration options */
export interface BufferOptions {
  /** Maximum number of events to buffer (default: 1000) */
  maxSize?: number
  /** Time-to-live for events in milliseconds (default: 5 minutes) */
  ttlMs?: number
}

// ============================================================================
// EVENT BUFFER CLASS
// ============================================================================

/**
 * Circular buffer for gateway events with TTL support.
 * Events can be retrieved by sequence number for reconnection scenarios.
 */
export class EventBuffer {
  private events: BufferedEvent[] = []
  private readonly maxSize: number
  private readonly ttlMs: number
  private currentSeq: number = 0
  private totalBuffered: number = 0
  private totalExpired: number = 0

  constructor(options: BufferOptions = {}) {
    this.maxSize = options.maxSize ?? 1000
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Add an event to the buffer
   */
  add(event: string, payload: unknown, seq?: number): number {
    const sequence = seq ?? ++this.currentSeq

    const bufferedEvent: BufferedEvent = {
      seq: sequence,
      event,
      payload,
      timestamp: new Date(),
      acknowledged: false
    }

    // Add to buffer
    this.events.push(bufferedEvent)
    this.totalBuffered++

    // Enforce max size by removing oldest events
    while (this.events.length > this.maxSize) {
      this.events.shift()
      this.totalExpired++
    }

    // Clean up expired events
    this.cleanupExpired()

    return sequence
  }

  /**
   * Get events since a specific sequence number
   * @param sinceSeq Starting sequence number (exclusive). If null, returns all events.
   */
  getSince(sinceSeq?: number | null): BufferedEvent[] {
    // Clean up expired events first
    this.cleanupExpired()

    if (sinceSeq === null || sinceSeq === undefined) {
      return [...this.events]
    }

    const filtered = this.events.filter(e => e.seq > sinceSeq)
    return filtered
  }

  /**
   * Get a specific event by sequence number
   */
  get(seq: number): BufferedEvent | null {
    return this.events.find(e => e.seq === seq) ?? null
  }

  /**
   * Get the latest sequence number
   */
  getLatestSeq(): number {
    return this.currentSeq
  }

  /**
   * Get the oldest sequence number currently in buffer
   */
  getOldestSeq(): number | null {
    if (this.events.length === 0) return null
    return this.events[0].seq
  }

  /**
   * Check if a sequence number is available in buffer
   */
  hasSeq(seq: number): boolean {
    return this.events.some(e => e.seq === seq)
  }

  /**
   * Get buffer statistics
   */
  getStats(): BufferStats {
    return {
      size: this.events.length,
      maxSize: this.maxSize,
      currentSeq: this.currentSeq,
      oldestSeq: this.getOldestSeq(),
      totalBuffered: this.totalBuffered,
      totalExpired: this.totalExpired
    }
  }

  /**
   * Clear all events from buffer
   */
  clear(): void {
    this.events = []
    // Don't reset currentSeq - it should keep incrementing
  }

  /**
   * Mark events as acknowledged
   */
  acknowledge(seq: number): void {
    const event = this.events.find(e => e.seq === seq)
    if (event) {
      event.acknowledged = true
    }
  }

  /**
   * Remove events older than a specific sequence number
   */
  pruneBefore(seq: number): number {
    const beforeLength = this.events.length
    this.events = this.events.filter(e => e.seq >= seq)
    const removed = beforeLength - this.events.length
    this.totalExpired += removed
    return removed
  }

  /**
   * Clean up expired events based on TTL
   */
  private cleanupExpired(): void {
    const now = Date.now()
    const beforeLength = this.events.length

    this.events = this.events.filter(e => {
      const age = now - e.timestamp.getTime()
      return age < this.ttlMs
    })

    const removed = beforeLength - this.events.length
    if (removed > 0) {
      this.totalExpired += removed
    }
  }

  /**
   * Create a checkpoint that can be used to resume
   */
  createCheckpoint(): number {
    return this.currentSeq
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert an EventFrame to a buffered event
 */
export function eventFrameToBuffered(frame: EventFrame, seq: number): BufferedEvent {
  return {
    seq,
    event: frame.event,
    payload: frame.payload,
    timestamp: new Date(),
    acknowledged: false
  }
}

/**
 * Extract sequence number from a gateway event frame
 */
export function extractSeq(frame: EventFrame): number | undefined {
  return frame.seq
}
