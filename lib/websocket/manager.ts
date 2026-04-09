import type { WebSocket } from 'ws'
import logger, { logCategories } from '@/lib/logger/index.js'

interface Client {
  ws: WebSocket
  userId: string
  subscribedSessions: Set<string>
}

class WebSocketManager {
  private clients: Map<string, Client> = new Map()

  addClient(clientId: string, ws: WebSocket, userId: string) {
    this.clients.set(clientId, {
      ws,
      userId,
      subscribedSessions: new Set(),
    })
    logger.info({ category: logCategories.WS_MANAGER }, 'Client %s connected (user: %s)', clientId, userId)
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      this.clients.delete(clientId)
      logger.info({ category: logCategories.WS_MANAGER }, 'Client %s disconnected', clientId)
    }
  }

  subscribe(clientId: string, sessionId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      client.subscribedSessions.add(sessionId)
      logger.info({ category: logCategories.WS_MANAGER }, 'Client %s subscribed to session %s', clientId, sessionId)
    }
  }

  unsubscribe(clientId: string, sessionId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      client.subscribedSessions.delete(sessionId)
      logger.info({ category: logCategories.WS_MANAGER }, 'Client %s unsubscribed from session %s', clientId, sessionId)
    }
  }

  broadcast(sessionId: string, message: any) {
    let sentCount = 0
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.subscribedSessions.has(sessionId) && client.ws.readyState === 1) {
        try {
          client.ws.send(JSON.stringify(message))
          sentCount++
        } catch (error) {
          logger.error({ category: logCategories.WS_MANAGER }, 'Failed to send to client %s: %s', clientId, String(error))
        }
      }
    }
    
    if (sentCount > 0) {
      logger.debug({ category: logCategories.WS_MANAGER }, 'Broadcast to %s clients for session %s', sentCount, sessionId)
    }
  }

  getClient(clientId: string): Client | undefined {
    return this.clients.get(clientId)
  }

  getClientCount(): number {
    return this.clients.size
  }
}

let wsManager: WebSocketManager | null = null

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager()
  }
  return wsManager
}
