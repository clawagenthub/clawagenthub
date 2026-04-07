/**
 * Gateway Session Types
 * 
 * Type definitions for the session instance module.
 */

import type { WebSocket } from 'ws'
import type { GatewayConfig } from './config.js'
import type { InstanceState } from './protocol.js'

// ============================================================================
// CLIENT TYPES
// ============================================================================

/** Client connection handler */
export interface ClientConnection {
  id: string
  ws: WebSocket
  userId: string
  connectedAt: Date
  lastSeq?: number  // Last sequence number received by client
}

// ============================================================================
// SESSION OPTIONS
// ============================================================================

/** Session instance options */
export interface SessionInstanceOptions {
  sessionId: string
  agentId: string
  sessionKey?: string
  gateway: GatewayConfig
  origin?: string
  idleTimeout?: number  // Minutes before stopping instance when idle
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Pending request to gateway */
export interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timeout: ReturnType<typeof setTimeout>
}

/** Client message types */
export type ClientMessage =
  | { type: 'chat.send'; content: string; options?: Record<string, unknown> }
  | { type: 'chat.abort'; runId: string }
  | { type: 'ping' }

// ============================================================================
// STATUS TYPES
// ============================================================================

/** Instance status for monitoring */
export interface SessionStatus {
  sessionId: string
  agentId: string
  sessionKey: string
  gatewayId: string
  state: InstanceState
  clientCount: number
  currentSeq: number
  connectedAt?: Date
  lastActivityAt: Date
  error?: string
  bufferStats: {
    size: number
    oldestSeq: number
    newestSeq: number
  }
}
