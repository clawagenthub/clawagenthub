import type { IncomingMessage } from 'http'
import type { WebSocket } from 'ws'

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
    console.log(`[WSManager] Client ${clientId} connected (user: ${userId})`)
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      this.clients.delete(clientId)
      console.log(`[WSManager] Client ${clientId} disconnected`)
    }
  }

  subscribe(clientId: string, sessionId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      client.subscribedSessions.add(sessionId)
      console.log(`[WSManager] Client ${clientId} subscribed to session ${sessionId}`)
    }
  }

  unsubscribe(clientId: string, sessionId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      client.subscribedSessions.delete(sessionId)
      console.log(`[WSManager] Client ${clientId} unsubscribed from session ${sessionId}`)
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
          console.error(`[WSManager] Failed to send to client ${clientId}:`, error)
        }
      }
    }
    
    if (sentCount > 0) {
      console.log(`[WSManager] Broadcast to ${sentCount} clients for session ${sessionId}`)
    }
  }

  getClient(clientId: string): Client | undefined {
    return this.clients.get(clientId)
  }

  getClientCount(): number {
    return this.clients.size
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager()
  }
  return wsManager
}
