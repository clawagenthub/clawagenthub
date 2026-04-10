/**
 * Gateway Session Event Handling
 * 
 * Handles event callbacks and broadcasting to clients.
 */

import type { InstanceEvent } from './protocol.js'
import type { ClientConnection } from './session-types.js'
import logger from '@/lib/logger/index.js'


/**
 * Event callback manager for session instance
 */
export class SessionEventManager {
  private callbacks: Set<(event: InstanceEvent) => void> = new Set()

  /**
   * Register an event callback
   * @returns Unsubscribe function
   */
  onEvent(callback: (event: InstanceEvent) => void): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  /**
   * Notify all registered callbacks
   */
  notify(event: InstanceEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event)
      } catch (error) {
        logger.error('[SessionInstance] Event callback error:', error)
      }
    }
  }

  /**
   * Check if there are registered callbacks
   */
  hasCallbacks(): boolean {
    return this.callbacks.size > 0
  }
}

/**
 * Send an event to a single client WebSocket
 */
export function sendToClient(
  client: ClientConnection,
  event: InstanceEvent
): void {
  if (client.ws.readyState !== 1) { // WebSocket.OPEN = 1
    return
  }

  try {
    client.ws.send(JSON.stringify(event))
  } catch (error) {
    logger.error('[SessionInstance] Failed to send to client:', {
      clientId: client.id,
      error
    })
  }
}

/**
 * Broadcast an event to all clients
 */
export function broadcastToClients(
  clients: Map<string, ClientConnection>,
  event: InstanceEvent
): void {
  for (const client of clients.values()) {
    sendToClient(client, event)
  }
}
