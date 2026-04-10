import { getGatewayManager } from '@/lib/gateway/manager'
import { getWebSocketManager } from '@/lib/websocket/manager'
import { getDatabase } from '@/lib/db'
import { getSessionStatusTracker } from '@/lib/session/status-tracker'
import logger, { logCategories } from '@/lib/logger/index.js'

interface GatewayEventForwarder {
  start(): void
  stop(): void
  isRunning(): boolean
}

/**
 * GatewayEventBridge forwards OpenClaw gateway events to browser WebSocket clients.
 * 
 * This service:
 * 1. Subscribes to 'chat' and 'agent' events from connected gateways
 * 2. Maps session keys to session IDs
 * 3. Forwards relevant events to subscribed browser clients
 */
class GatewayEventBridge implements GatewayEventForwarder {
  private running = false
  private eventUnsubscribers: Map<string, () => void> = new Map()
  private sessionKeyToIdCache: Map<string, string> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_TTL = 60000 // 1 minute

  /**
   * Map a gateway session key to a ClawAgentHub session ID
   */
  private resolveSessionId(sessionKey: string): string | null {
    // Check cache first
    const cachedId = this.sessionKeyToIdCache.get(sessionKey)
    const expiry = this.cacheExpiry.get(sessionKey)
    
    if (cachedId && expiry && Date.now() < expiry) {
      return cachedId
    }
    
    // Query database for session ID
    const db = getDatabase()
    const session = db
      .prepare('SELECT id FROM chat_sessions WHERE session_key = ? LIMIT 1')
      .get(sessionKey) as { id: string } | undefined
    
    if (session) {
      // Cache the result
      this.sessionKeyToIdCache.set(sessionKey, session.id)
      this.cacheExpiry.set(sessionKey, Date.now() + this.CACHE_TTL)
      return session.id
    }
    
    return null
  }

  /**
   * Handle chat events from OpenClaw gateway
   */
  private handleChatEvent = (event: any) => {
    logger.debug({ category: logCategories.GATEWAY_EVENTS }, 'Chat event received: type=%s, hasPayload=%s, sessionKey=%s',
      event.event, !!event.payload, event.payload?.sessionKey)

    const payload = event.payload || event
    const sessionKey = payload.sessionKey

    if (!sessionKey) {
      return
    }

    // Resolve session key to session ID
    const sessionId = this.resolveSessionId(sessionKey)
    if (!sessionId) {
      logger.debug({ category: logCategories.GATEWAY_EVENTS }, 'No session found for sessionKey: %s', sessionKey)
      return
    }

    // Forward to subscribed browser clients
    const wsManager = getWebSocketManager()
    
    // Transform OpenClaw event to browser event format
    const browserEvent = {
      type: 'chat.delta',
      sessionId,
      data: {
        runId: payload.runId,
        state: payload.state, // 'delta' | 'final' | 'error'
        message: payload.message,
        errorMessage: payload.errorMessage,
      }
    }

    // Update session status tracker based on chat events
    const statusTracker = getSessionStatusTracker()

    // Handle different event states
    if (payload.state === 'delta') {
      browserEvent.type = 'chat.delta'
      wsManager.broadcast(sessionId, browserEvent)
      
      // Update status to writing when streaming delta
      statusTracker.updateStatus(sessionId, {
        sessionKey,
        status: 'writing',
        runId: payload.runId,
        lastActivity: Date.now(),
      })
    } else if (payload.state === 'final') {
      browserEvent.type = 'chat.final'
      wsManager.broadcast(sessionId, browserEvent)
      
      // Check for stopReason to determine if it was an error
      const isError = payload.message && typeof payload.message === 'object'
        ? (payload.message as Record<string, unknown>).stopReason === 'error'
        : false
      
      // Return to idle after final
      statusTracker.updateStatus(sessionId, {
        sessionKey,
        status: isError ? 'failed' : 'idle',
        runId: payload.runId,
        lastActivity: Date.now(),
      })
      
      // Invalidate queries so messages are refetched
      // Note: This happens in the background; streaming client already has the data
    } else if (payload.state === 'error') {
      browserEvent.type = 'chat.error'
      wsManager.broadcast(sessionId, browserEvent)
      
      // Mark as failed on error
      statusTracker.updateStatus(sessionId, {
        sessionKey,
        status: 'failed',
        runId: payload.runId,
        lastActivity: Date.now(),
      })
    } else if (payload.state === 'aborted') {
      browserEvent.type = 'chat.aborted'
      wsManager.broadcast(sessionId, browserEvent)
      
      // Return to idle on abort
      statusTracker.updateStatus(sessionId, {
        sessionKey,
        status: 'idle',
        runId: payload.runId,
        lastActivity: Date.now(),
      })
    }
  }

  /**
   * Handle agent events from OpenClaw gateway
   */
  private handleAgentEvent = (event: any) => {
    logger.debug({ category: logCategories.GATEWAY_EVENTS }, 'Agent event received: stream=%s, hasPayload=%s, sessionKey=%s',
      event.payload?.stream, !!event.payload, event.payload?.sessionKey)

    const payload = event.payload || event
    const sessionKey = payload.sessionKey

    if (!sessionKey) {
      return
    }

    // Resolve session key to session ID
    const sessionId = this.resolveSessionId(sessionKey)
    if (!sessionId) {
      return
    }

    const wsManager = getWebSocketManager()
    const statusTracker = getSessionStatusTracker()

    // Transform based on event type
    const streamType = payload.stream
    
    if (streamType === 'tool') {
      const phase = payload.data?.phase
      const toolName = payload.data?.name || 'Tool'
      
      if (phase === 'start') {
        wsManager.broadcast(sessionId, {
          type: 'agent',
          sessionId,
          data: {
            stream: 'tool',
            phase: 'start',
            name: toolName,
          }
        })
        
        // Update status to calling_mcp when tool starts
        statusTracker.updateStatus(sessionId, {
          sessionKey,
          status: 'calling_mcp',
          runId: payload.runId,
          toolName,
          lastActivity: Date.now(),
        })
      } else if (phase === 'update') {
        wsManager.broadcast(sessionId, {
          type: 'agent',
          sessionId,
          data: {
            stream: 'tool',
            phase: 'update',
            name: toolName,
            partialResult: payload.data?.partialResult,
          }
        })
      } else if (phase === 'result' || phase === 'end' || phase === 'error') {
        wsManager.broadcast(sessionId, {
          type: 'agent',
          sessionId,
          data: {
            stream: 'tool',
            phase,
            name: toolName,
            result: payload.data?.result,
            error: payload.data?.error,
          }
        })
        
        // Return to thinking after tool completes (before writing starts)
        statusTracker.updateStatus(sessionId, {
          sessionKey,
          status: 'thinking',
          runId: payload.runId,
          lastActivity: Date.now(),
        })
      }
    } else if (streamType === 'lifecycle') {
      const phase = payload.data?.phase
      
      if (phase === 'start') {
        wsManager.broadcast(sessionId, {
          type: 'agent',
          sessionId,
          data: {
            stream: 'lifecycle',
            phase: 'start',
          }
        })
        
        // Update status to thinking when lifecycle starts
        statusTracker.updateStatus(sessionId, {
          sessionKey,
          status: 'thinking',
          runId: payload.runId,
          lastActivity: Date.now(),
        })
      } else if (phase === 'end') {
        wsManager.broadcast(sessionId, {
          type: 'agent',
          sessionId,
          data: {
            stream: 'lifecycle',
            phase: 'end',
          }
        })
        
        // Return to idle when lifecycle ends
        statusTracker.updateStatus(sessionId, {
          sessionKey,
          status: 'idle',
          runId: payload.runId,
          lastActivity: Date.now(),
        })
      } else if (phase === 'error') {
        wsManager.broadcast(sessionId, {
          type: 'agent',
          sessionId,
          data: {
            stream: 'lifecycle',
            phase: 'error',
          }
        })
        
        // Mark as failed on lifecycle error
        statusTracker.updateStatus(sessionId, {
          sessionKey,
          status: 'failed',
          runId: payload.runId,
          lastActivity: Date.now(),
        })
      }
    }
  }

  /**
   * Subscribe to events from a specific gateway
   */
  private subscribeToGateway(gatewayId: string) {
    const manager = getGatewayManager()
    const client = manager.getClient(gatewayId)
    
    if (!client) {
      logger.warn({ category: logCategories.GATEWAY_EVENTS }, 'No client for gateway: %s', gatewayId)
      return
    }

    // Subscribe to chat events
    const chatUnsub = client.onEvent('chat', this.handleChatEvent)
    
    // Subscribe to agent events
    const agentUnsub = client.onEvent('agent', this.handleAgentEvent)
    
    // Store unsubscribe function
    this.eventUnsubscribers.set(gatewayId, () => {
      chatUnsub()
      agentUnsub()
    })
    
    logger.debug({ category: logCategories.GATEWAY_EVENTS }, 'Subscribed to events from gateway: %s', gatewayId)
  }

  /**
   * Start forwarding events from all connected gateways
   */
  start() {
    if (this.running) {
      logger.debug({ category: logCategories.GATEWAY_EVENTS }, 'Already running')
      return
    }

    logger.info({ category: logCategories.GATEWAY_EVENTS }, 'Starting gateway event bridge...')
    
    // Also start the session status tracker
    const statusTracker = getSessionStatusTracker()
    if (!statusTracker.isRunning()) {
      statusTracker.start()
    }
    
    // Subscribe to all currently connected gateways
    // Note: We need to access the connections map which is private
    // For now, we'll hook into the gateway initialization
    
    this.running = true
    logger.info({ category: logCategories.GATEWAY_EVENTS }, 'Gateway event bridge started')
  }

  /**
   * Stop forwarding events
   */
  stop() {
    if (!this.running) {
      return
    }

    logger.info({ category: logCategories.GATEWAY_EVENTS }, 'Stopping gateway event bridge...')
    
    // Unsubscribe from all events
    for (const unsub of this.eventUnsubscribers.values()) {
      unsub()
    }
    this.eventUnsubscribers.clear()
    
    // Also stop the session status tracker
    const statusTracker = getSessionStatusTracker()
    if (statusTracker.isRunning()) {
      statusTracker.stop()
    }
    
    this.running = false
    logger.info({ category: logCategories.GATEWAY_EVENTS }, 'Gateway event bridge stopped')
  }

  isRunning(): boolean {
    return this.running
  }

  /**
   * Register a gateway for event forwarding
   * Call this when a new gateway connects
   */
  registerGateway(gatewayId: string) {
    if (this.running) {
      this.subscribeToGateway(gatewayId)
    }
  }

  /**
   * Unregister a gateway
   * Call this when a gateway disconnects
   */
  unregisterGateway(gatewayId: string) {
    const unsub = this.eventUnsubscribers.get(gatewayId)
    if (unsub) {
      unsub()
      this.eventUnsubscribers.delete(gatewayId)
    }
    
    // Clear cache entries for this gateway's sessions
    // (We'd need to track which sessions belong to which gateway)
  }
}

// Singleton instance
let bridgeInstance: GatewayEventBridge | null = null

export function getGatewayEventBridge(): GatewayEventBridge {
  if (!bridgeInstance) {
    bridgeInstance = new GatewayEventBridge()
  }
  return bridgeInstance
}
