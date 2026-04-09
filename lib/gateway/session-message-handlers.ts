/**
 * Gateway Session Message Handlers
 * 
 * Handles messages from gateway and routes to appropriate handlers.
 */

import type { EventFrame, ResponseFrame } from './protocol.js'
import type { PendingRequest } from './session-types.js'
import logger, { logCategories } from '@/lib/logger/index.js'


export interface MessageHandlers {
  handleChatEvent: (frame: EventFrame) => void
  handleAgentEvent: (frame: EventFrame) => void
  bufferEvent: (frame: EventFrame) => void
  setGatewayAuthenticated: (authenticated: boolean) => void
  setConnectedAt: (date: Date) => void
  setState: (state: 'connecting' | 'connected' | 'disconnected' | 'error', error?: string) => void
  resolveConnect: () => void
}

export interface GatewayMessageContext {
  pendingRequests: Map<string, PendingRequest>
  gatewayAuthenticated: boolean
  sessionId: string
}

/**
 * Handle incoming gateway messages
 */
export function handleGatewayMessage(
  msg: Record<string, unknown>,
  handlers: MessageHandlers,
  context: GatewayMessageContext,
  connectTimeout: ReturnType<typeof setTimeout>
): void {
  // Handle event frames
  if (msg.type === 'event') {
    const evt = msg as unknown as EventFrame

    if (evt.event === 'connect.challenge') {
      // Challenge events are handled separately during connection
      return
    }

    if (evt.event === 'chat') {
      handlers.handleChatEvent(evt)
      return
    }

    if (evt.event === 'agent') {
      handlers.handleAgentEvent(evt)
      return
    }

    // Buffer all other events
    handlers.bufferEvent(evt)
    return
  }

  // Handle response frames
  if (msg.type === 'res') {
    const res = msg as unknown as ResponseFrame
    const pending = context.pendingRequests.get(res.id)
    
    if (!pending) return

    context.pendingRequests.delete(res.id)
    clearTimeout(pending.timeout)

    if (res.ok) {
      pending.resolve(res.payload)
    } else {
      pending.reject(new Error(res.error?.message ?? 'Unknown gateway error'))
    }

    // If this was the initial connect request
    if (res.id === 'connect') {
      clearTimeout(connectTimeout)
      handlers.setGatewayAuthenticated(true)
      handlers.setConnectedAt(new Date())
      handlers.setState('connected')
      handlers.resolveConnect()
    }
  }
}

/**
 * Parse JSON message safely
 */
export function parseGatewayMessage(data: WebSocket.Data): Record<string, unknown> | null {
  try {
    return JSON.parse(data.toString())
  } catch {
    logger.error('[SessionInstance] Failed to parse gateway message')
    return null
  }
}
