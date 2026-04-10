/**
 * Chat Event Builders for GatewaySessionInstance
 * Helper functions to build typed chat events
 */

import type {
  InstanceChatDeltaEvent,
  InstanceChatFinalEvent,
  InstanceChatErrorEvent,
  InstanceAgentTypingEvent,
  InstanceConnectedEvent,
  InstanceErrorEvent,
} from './protocol.js'
import type { ClientConnection } from './session-types.js'
import { sendToClient, broadcastToClients } from './session-events.js'
import type { ChatEventPayload } from './protocol.js'

/**
 * Build and broadcast a chat delta event
 */
export function buildChatDeltaEvent(
  clients: Map<string, ClientConnection>,
  sessionId: string,
  runId: string,
  seq: number,
  delta: string
): InstanceChatDeltaEvent {
  const event: InstanceChatDeltaEvent = {
    type: 'chat.delta',
    sessionId,
    runId,
    seq,
    delta,
  }
  broadcastToClients(clients, event)
  return event
}

/**
 * Build and broadcast a chat final event
 */
export function buildChatFinalEvent(
  clients: Map<string, ClientConnection>,
  sessionId: string,
  runId: string,
  seq: number,
  message: { content?: string; role?: string }
): InstanceChatFinalEvent {
  const event: InstanceChatFinalEvent = {
    type: 'chat.final',
    sessionId,
    runId,
    seq,
    message,
  }
  broadcastToClients(clients, event)
  return event
}

/**
 * Build and broadcast a chat error event
 */
export function buildChatErrorEvent(
  clients: Map<string, ClientConnection>,
  sessionId: string,
  runId: string,
  seq: number,
  errorMessage: string
): InstanceChatErrorEvent {
  const event: InstanceChatErrorEvent = {
    type: 'chat.error',
    sessionId,
    runId,
    seq,
    error: errorMessage,
  }
  broadcastToClients(clients, event)
  return event
}

/**
 * Build and broadcast an agent typing event
 */
export function buildAgentTypingEvent(
  clients: Map<string, ClientConnection>,
  sessionId: string,
  agentId: string,
  isTyping: boolean
): InstanceAgentTypingEvent {
  const event: InstanceAgentTypingEvent = {
    type: 'agent.typing',
    sessionId,
    agentId,
    isTyping,
  }
  broadcastToClients(clients, event)
  return event
}

/**
 * Send connected event to a specific client
 */
export function sendConnectedEvent(
  client: ClientConnection,
  sessionId: string,
  currentSeq: number
): InstanceConnectedEvent {
  const event: InstanceConnectedEvent = {
    type: 'connected',
    sessionId,
    currentSeq,
  }
  sendToClient(client, event)
  return event
}

/**
 * Broadcast an error event to all clients
 */
export function broadcastErrorEvent(
  clients: Map<string, ClientConnection>,
  sessionId: string,
  error: string
): InstanceErrorEvent {
  const event: InstanceErrorEvent = {
    type: 'error',
    sessionId,
    error,
  }
  broadcastToClients(clients, event)
  return event
}

/**
 * Handle chat payload based on state and broadcast appropriate event
 */
export function handleChatPayloadState(
  clients: Map<string, ClientConnection>,
  sessionId: string,
  payload: ChatEventPayload,
  seq: number
): void {
  switch (payload.state) {
    case 'delta':
      buildChatDeltaEvent(
        clients,
        sessionId,
        payload.runId,
        seq,
        payload.message?.content ?? ''
      )
      break
    case 'final':
      buildChatFinalEvent(
        clients,
        sessionId,
        payload.runId,
        seq,
        payload.message!
      )
      break
    case 'error':
      buildChatErrorEvent(
        clients,
        sessionId,
        payload.runId,
        seq,
        payload.errorMessage ?? 'Unknown error'
      )
      break
  }
}

/**
 * Send buffered chat events to a client
 */
export function sendBufferedChatEventsToClient(
  client: ClientConnection,
  sessionId: string,
  events: Array<{ event: string; payload: ChatEventPayload; seq: number }>
): void {
  for (const buffered of events) {
    if (buffered.event === 'chat') {
      const payload = buffered.payload
      switch (payload.state) {
        case 'delta':
          sendToClient(client, {
            type: 'chat.delta',
            sessionId,
            runId: payload.runId,
            seq: buffered.seq,
            delta: payload.message?.content ?? '',
          } as InstanceChatDeltaEvent)
          break
        case 'final':
          sendToClient(client, {
            type: 'chat.final',
            sessionId,
            runId: payload.runId,
            seq: buffered.seq,
            message: payload.message!,
          } as InstanceChatFinalEvent)
          break
        case 'error':
          sendToClient(client, {
            type: 'chat.error',
            sessionId,
            runId: payload.runId,
            seq: buffered.seq,
            error: payload.errorMessage ?? 'Unknown error',
          } as InstanceChatErrorEvent)
          break
      }
    }
  }
}
