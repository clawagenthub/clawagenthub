/**
 * Gateway Session Instance - Type Definitions
 * Extracted from session-instance.ts to reduce file length
 */

import type {
  ChatEventPayload,
  InstanceState,
  InstanceEvent,
  InstanceStateChangedEvent,
} from './protocol.js'
import type { ClientConnection } from './session-types.js'

// Gateway event frame types
export interface GatewayEventFrame {
  event: string
  payload?: unknown
  seq?: number
}

export interface GatewayChatEventFrame extends GatewayEventFrame {
  payload: ChatEventPayload
}

export interface GatewayAgentEventFrame extends GatewayEventFrame {
  payload: { agentId: string; isTyping?: boolean }
}

export interface GatewayChallengeEventFrame extends GatewayEventFrame {
  payload?: { nonce?: string }
}

// Gateway response frame type
export interface GatewayResponseFrame {
  id: string
  ok: boolean
  payload?: unknown
  error?: { message?: string }
}

// Buffered events type
export interface BufferedEvent {
  event: string
  payload: ChatEventPayload
  seq: number
}

// State change event creator
export function createStateChangedEvent(
  sessionId: string,
  newState: InstanceState,
  error?: string
): InstanceStateChangedEvent {
  return {
    type: 'state.changed',
    sessionId,
    state: newState,
    error,
  }
}

// Extract buffered events for client
export function extractBufferedEvents(
  client: ClientConnection,
  eventBuffer: { getSince: (seq: number) => BufferedEvent[] }
): BufferedEvent[] {
  return eventBuffer.getSince(client.lastSeq ?? 0) as BufferedEvent[]
}
