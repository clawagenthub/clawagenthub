/**
 * Gateway Session Instance
 * 
 * A persistent server-side WebSocket connection to the OpenClaw Gateway.
 * Each session instance represents a chat session with an agent.
 * 
 * Architecture:
 * - Multiple clients can connect to the same session instance
 * - The instance maintains a single persistent connection to the gateway
 * - Events are buffered for reconnection scenarios
 * - Chat sessions continue even when all clients disconnect
 */

import WebSocket from 'ws'
import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/db'
import type {
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ChatEventPayload,
  InstanceEvent,
  InstanceStateChangedEvent,
  InstanceChatDeltaEvent,
  InstanceChatFinalEvent,
  InstanceChatErrorEvent,
  InstanceConnectedEvent,
  InstanceErrorEvent,
  InstanceAgentTypingEvent,
  InstanceState
} from './protocol.js'
import { EventBuffer } from './buffer.js'
import type { GatewayConfig } from './config.js'

// ============================================================================
// TYPES
// ============================================================================

/** Client connection handler */
export interface ClientConnection {
  id: string
  ws: WebSocket
  userId: string
  connectedAt: Date
  lastSeq?: number  // Last sequence number received by client
}

/** Session instance options */
export interface SessionInstanceOptions {
  sessionId: string
  agentId: string
  sessionKey?: string
  gateway: GatewayConfig
  origin?: string
  idleTimeout?: number  // Minutes before stopping instance when idle
}

/** Pending request to gateway */
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timeout: ReturnType<typeof setTimeout>
}

/** Message from client */
type ClientMessage =
  | { type: 'chat.send'; content: string; options?: Record<string, unknown> }
  | { type: 'chat.abort'; runId: string }
  | { type: 'ping' }

// ============================================================================
// SESSION INSTANCE CLASS
// ============================================================================

export class GatewaySessionInstance {
  // Instance identification
  private readonly sessionId: string
  private readonly agentId: string
  private readonly sessionKey: string
  private readonly gatewayId: string
  private readonly gatewayUrl: string
  private readonly authToken: string
  private readonly origin?: string

  // State
  private state: InstanceState = 'idle'
  private error?: string
  private connectedAt?: Date
  private lastActivityAt: Date = new Date()

  // Gateway connection
  private gatewayWs: WebSocket | null = null
  private gatewayAuthenticated = false
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null

  // Event buffering
  private eventBuffer: EventBuffer

  // Client connections
  private clients: Map<string, ClientConnection> = new Map()

  // Event callbacks
  private onEventCallbacks: Set<(event: InstanceEvent) => void> = new Set()

  // Configuration
  private readonly idleTimeoutMinutes: number

  constructor(options: SessionInstanceOptions) {
    this.sessionId = options.sessionId
    this.agentId = options.agentId
    this.sessionKey = options.sessionKey ?? `agent:${this.agentId}:main`
    this.gatewayId = options.gateway.id
    this.gatewayUrl = options.gateway.url
    this.authToken = options.gateway.authToken
    this.origin = options.origin
    this.idleTimeoutMinutes = options.idleTimeout ?? 30

    // Initialize event buffer
    this.eventBuffer = new EventBuffer({
      maxSize: 1000,
      ttlMs: 5 * 60 * 1000  // 5 minutes
    })

    console.log('[SessionInstance] Created', {
      sessionId: this.sessionId,
      agentId: this.agentId,
      sessionKey: this.sessionKey,
      gatewayId: this.gatewayId
    })
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  /**
   * Start the session instance (connect to gateway)
   */
  async start(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      console.log('[SessionInstance] Already connected/connecting', {
        sessionId: this.sessionId,
        state: this.state
      })
      return
    }

    console.log('[SessionInstance] Starting', {
      sessionId: this.sessionId,
      sessionKey: this.sessionKey
    })

    this.setState('connecting')
    await this.connectToGateway()
    this.scheduleIdleCheck()
  }

  /**
   * Stop the session instance
   */
  stop(): void {
    console.log('[SessionInstance] Stopping', {
      sessionId: this.sessionId
    })

    this.setState('stopped')
    this.disconnectFromGateway()
    this.clearIdleTimer()
    this.clearReconnectTimer()
  }

  /**
   * Check if instance is active
   */
  isActive(): boolean {
    return this.state === 'connected' || this.state === 'connecting'
  }

  /**
   * Get current state
   */
  getState(): InstanceState {
    return this.state
  }

  // ========================================================================
  // CLIENT MANAGEMENT
  // ========================================================================

  /**
   * Add a client connection
   */
  addClient(clientId: string, ws: WebSocket, userId: string, sinceSeq?: number): void {
    const client: ClientConnection = {
      id: clientId,
      ws,
      userId,
      connectedAt: new Date(),
      lastSeq: sinceSeq
    }

    this.clients.set(clientId, client)
    this.updateActivity()
    console.log('[SessionInstance] Client added', {
      sessionId: this.sessionId,
      clientId,
      userId,
      clientCount: this.clients.size
    })

    // Send buffered events to the new client
    if (sinceSeq !== undefined) {
      const events = this.eventBuffer.getSince(sinceSeq)
      this.sendBufferedEvents(client, events)
    }

    // Send connected event with current sequence
    this.sendToClient(client, {
      type: 'connected',
      sessionId: this.sessionId,
      currentSeq: this.eventBuffer.getLatestSeq()
    } as InstanceConnectedEvent)
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) return

    // Important: do NOT close the browser WebSocket here.
    // The WebSocket lifecycle belongs to /api/chat/ws route handlers.
    // Closing it here breaks "instance.unsubscribe" and can drop clients
    // that should stay connected for future re-subscribe/reconnect.

    this.clients.delete(clientId)
    console.log('[SessionInstance] Client removed', {
      sessionId: this.sessionId,
      clientId,
      remainingClients: this.clients.size
    })

    // Check if instance should be stopped
    if (this.clients.size === 0) {
      console.log('[SessionInstance] No clients remaining, scheduling idle check', {
        sessionId: this.sessionId
      })
      this.scheduleIdleCheck()
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Handle message from client
   */
  async handleClientMessage(clientId: string, message: ClientMessage): Promise<void> {
    const client = this.clients.get(clientId)
    if (!client) {
      console.warn('[SessionInstance] Client not found for message', {
        sessionId: this.sessionId,
        clientId
      })
      return
    }

    this.updateActivity()

    switch (message.type) {
      case 'chat.send':
        await this.sendChatMessage(message.content, message.options)
        break

      case 'chat.abort':
        await this.abortChat(message.runId)
        break

      case 'ping':
        this.sendToClient(client, { type: 'pong', sessionId: this.sessionId, timestamp: Date.now() })
        break

      default:
        console.warn('[SessionInstance] Unknown message type', {
          type: (message as { type: string }).type
        })
    }
  }

  // ========================================================================
  // GATEWAY CONNECTION
  // ========================================================================

  private async connectToGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const origin = this.origin || this.determineOrigin()
        console.log('[SessionInstance] Connecting to gateway', {
          sessionId: this.sessionId,
          url: this.gatewayUrl,
          origin
        })

        this.gatewayWs = new WebSocket(this.gatewayUrl, {
          maxPayload: 25 * 1024 * 1024,
          headers: {
            'Origin': origin
          }
        })

        const connectTimeout = setTimeout(() => {
          reject(new Error('Gateway connection timeout (10s)'))
          this.gatewayWs?.close()
        }, 10000)

        this.gatewayWs.on('open', () => {
          console.log('[SessionInstance] Gateway WebSocket opened', {
            sessionId: this.sessionId
          })
        })

        this.gatewayWs.on('message', (data: WebSocket.Data) => {
          try {
            const parsed = JSON.parse(data.toString())
            this.handleGatewayMessage(parsed, connectTimeout, resolve, reject)
          } catch (error) {
            console.error('[SessionInstance] Failed to parse gateway message:', error)
          }
        })

        this.gatewayWs.on('close', () => {
          console.log('[SessionInstance] Gateway WebSocket closed', {
            sessionId: this.sessionId
          })
          this.gatewayAuthenticated = false
          this.setState('disconnected')
          this.scheduleReconnect()
        })

        this.gatewayWs.on('error', (err) => {
          console.error('[SessionInstance] Gateway WebSocket error:', err)
          clearTimeout(connectTimeout)
          if (!this.gatewayAuthenticated) {
            reject(err)
          }
        })

      } catch (err) {
        reject(err)
      }
    })
  }

  private disconnectFromGateway(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.gatewayWs) {
      this.gatewayWs.close()
      this.gatewayWs = null
    }

    this.gatewayAuthenticated = false
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.state === 'stopped') return

    console.log('[SessionInstance] Scheduling reconnect', {
      sessionId: this.sessionId
    })

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.state !== 'stopped') {
        this.connectToGateway().catch(() => {
          // Will retry again
        })
      }
    }, 3000)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ========================================================================
  // GATEWAY MESSAGE HANDLING
  // ========================================================================

  private handleGatewayMessage(
    msg: Record<string, unknown>,
    connectTimeout: ReturnType<typeof setTimeout>,
    resolve?: () => void,
    reject?: (err: Error) => void
  ): void {
    // Event frame
    if (msg.type === 'event') {
      const evt = msg as unknown as EventFrame

      // Handle connect.challenge
      if (evt.event === 'connect.challenge') {
        this.sendConnectRequest(evt.payload as { nonce?: string } | undefined, connectTimeout, resolve, reject)
        return
      }

      // Handle chat events
      if (evt.event === 'chat') {
        this.handleChatEvent(evt)
        return
      }

      // Handle agent events (typing indicators)
      if (evt.event === 'agent') {
        this.handleAgentEvent(evt)
        return
      }

      // Buffer all other events
      this.bufferEvent(evt)
    }

    // Response frame
    if (msg.type === 'res') {
      const res = msg as unknown as ResponseFrame
      const pending = this.pendingRequests.get(res.id)
      if (!pending) return

      this.pendingRequests.delete(res.id)
      clearTimeout(pending.timeout)

      if (res.ok) {
        pending.resolve(res.payload)
      } else {
        pending.reject(new Error(res.error?.message ?? 'Unknown gateway error'))
      }

      // If this was the initial connect request
      if (res.id === 'connect') {
        clearTimeout(connectTimeout)
        this.gatewayAuthenticated = true
        this.setState('connected')
        this.connectedAt = new Date()
        console.log('[SessionInstance] Connected to gateway', {
          sessionId: this.sessionId
        })
        resolve?.()
      }
    }
  }

  private handleChatEvent(frame: EventFrame): void {
    const payload = frame.payload as ChatEventPayload
    const seq = this.eventBuffer.add('chat', payload, frame.seq)

    // Keep instance active while gateway events are flowing, even without clients
    this.updateActivity()

    // Broadcast to clients based on state
    switch (payload.state) {
      case 'delta':
        this.broadcastToClients({
          type: 'chat.delta',
          sessionId: this.sessionId,
          runId: payload.runId,
          seq,
          delta: payload.message?.content ?? ''
        } as InstanceChatDeltaEvent)
        break

      case 'final':
        this.persistAssistantFinalMessage(payload)
        this.broadcastToClients({
          type: 'chat.final',
          sessionId: this.sessionId,
          runId: payload.runId,
          seq,
          message: payload.message!
        } as InstanceChatFinalEvent)
        break

      case 'error':
        this.broadcastToClients({
          type: 'chat.error',
          sessionId: this.sessionId,
          runId: payload.runId,
          seq,
          error: payload.errorMessage ?? 'Unknown error'
        } as InstanceChatErrorEvent)
        break
    }
  }

  private handleAgentEvent(frame: EventFrame): void {
    this.bufferEvent(frame)

    // Handle typing indicators
    const payload = frame.payload as { agentId: string; isTyping?: boolean }
    this.broadcastToClients({
      type: 'agent.typing',
      sessionId: this.sessionId,
      agentId: payload.agentId ?? this.agentId,
      isTyping: payload.isTyping ?? true
    } as InstanceAgentTypingEvent)
  }

  private bufferEvent(frame: EventFrame): void {
    this.eventBuffer.add(frame.event, frame.payload, frame.seq)
  }

  // ========================================================================
  // GATEWAY REQUESTS
  // ========================================================================

  private sendConnectRequest(
    challenge: { nonce?: string } | undefined,
    connectTimeout: ReturnType<typeof setTimeout>,
    resolve?: () => void,
    reject?: (err: Error) => void
  ): void {
    const frame: RequestFrame = {
      type: 'req',
      id: 'connect',
      method: 'connect',
      params: {
        token: this.authToken,
        nonce: challenge?.nonce
      }
    }

    this.sendToGateway(frame, connectTimeout, resolve, reject)
  }

  private async callGateway(method: string, params?: unknown, timeoutMs = 30000): Promise<unknown> {
    if (!this.gatewayWs || this.gatewayWs.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected')
    }

    const id = randomUUID()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Gateway request timeout: ${method}`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      const frame: RequestFrame = {
        type: 'req',
        id,
        method,
        params
      }

      try {
        this.gatewayWs!.send(JSON.stringify(frame))
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequests.delete(id)
        reject(error)
      }
    })
  }

  private sendToGateway(
    frame: RequestFrame,
    connectTimeout?: ReturnType<typeof setTimeout>,
    resolve?: () => void,
    reject?: (err: Error) => void
  ): void {
    if (!this.gatewayWs || this.gatewayWs.readyState !== WebSocket.OPEN) {
      reject?.(new Error('Gateway not connected'))
      return
    }

    try {
      this.gatewayWs.send(JSON.stringify(frame))
    } catch (error) {
      clearTimeout(connectTimeout)
      reject?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // ========================================================================
  // CHAT METHODS
  // ========================================================================

  private async sendChatMessage(content: string, options?: Record<string, unknown>): Promise<void> {
    console.log('[SessionInstance] Sending chat message', {
      sessionId: this.sessionId,
      sessionKey: this.sessionKey,
      contentLength: content.length
    })

    try {
      const result = await this.callGateway('chat.send', {
        sessionKey: this.sessionKey,
        message: content,
        idempotencyKey: randomUUID(),
        thinking: options?.thinking,
        deliver: options?.deliver ?? true
      }) as { runId: string; status: string }

      console.log('[SessionInstance] Chat message sent', {
        sessionId: this.sessionId,
        runId: result.runId,
        status: result.status
      })

      this.persistUserMessage(content, result.runId)
    } catch (error) {
      console.error('[SessionInstance] Failed to send chat message:', error)
      this.broadcastToClients({
        type: 'error',
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : 'Failed to send message'
      } as InstanceErrorEvent)
      throw error
    }
  }

  private persistUserMessage(content: string, runId: string): void {
    try {
      const db = getDatabase()
      const now = new Date().toISOString()
      const contentBlocks = JSON.stringify([{ type: 'text', text: content }])
      const metadata = JSON.stringify({ runId, source: 'instance-bridge' })

      db.prepare(
        `INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
         VALUES (?, ?, 'user', ?, ?, ?)`
      ).run(randomUUID(), this.sessionId, contentBlocks, metadata, now)

      db.prepare(
        `UPDATE chat_sessions
         SET status = 'active', last_activity_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(now, now, this.sessionId)
    } catch (error) {
      console.error('[SessionInstance] Failed to persist user message:', {
        sessionId: this.sessionId,
        runId,
        error
      })
    }
  }

  private persistAssistantFinalMessage(payload: ChatEventPayload): void {
    try {
      const messageText = payload.message?.content
      if (!messageText || !messageText.trim()) {
        return
      }

      const db = getDatabase()
      const existing = db.prepare(
        `SELECT id FROM chat_messages
         WHERE session_id = ?
           AND role = 'assistant'
           AND json_extract(metadata, '$.runId') = ?
         LIMIT 1`
      ).get(this.sessionId, payload.runId) as { id: string } | undefined

      if (existing) {
        return
      }

      const now = new Date().toISOString()
      const contentBlocks = JSON.stringify([{ type: 'text', text: messageText }])
      const metadata = JSON.stringify({ runId: payload.runId, source: 'instance-bridge' })

      db.prepare(
        `INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?)`
      ).run(randomUUID(), this.sessionId, contentBlocks, metadata, now)

      db.prepare(
        `UPDATE chat_sessions
         SET status = 'active', last_activity_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(now, now, this.sessionId)
    } catch (error) {
      console.error('[SessionInstance] Failed to persist assistant final message:', {
        sessionId: this.sessionId,
        runId: payload.runId,
        error
      })
    }
  }

  private async abortChat(runId: string): Promise<void> {
    console.log('[SessionInstance] Aborting chat', {
      sessionId: this.sessionId,
      runId
    })

    try {
      await this.callGateway('chat.abort', { runId })
    } catch (error) {
      console.error('[SessionInstance] Failed to abort chat:', error)
    }
  }

  // ========================================================================
  // CLIENT COMMUNICATION
  // ========================================================================

  private sendToClient(client: ClientConnection, event: InstanceEvent): void {
    if (client.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      client.ws.send(JSON.stringify(event))
    } catch (error) {
      console.error('[SessionInstance] Failed to send to client:', {
        clientId: client.id,
        error
      })
    }
  }

  private sendBufferedEvents(client: ClientConnection, events: unknown[]): void {
    for (const event of events) {
      const buffered = event as { event: string; payload: unknown; seq: number }

      // Convert buffered event to instance event
      if (buffered.event === 'chat') {
        const payload = buffered.payload as ChatEventPayload

        switch (payload.state) {
          case 'delta':
            this.sendToClient(client, {
              type: 'chat.delta',
              sessionId: this.sessionId,
              runId: payload.runId,
              seq: buffered.seq,
              delta: payload.message?.content ?? ''
            } as InstanceChatDeltaEvent)
            break

          case 'final':
            this.sendToClient(client, {
              type: 'chat.final',
              sessionId: this.sessionId,
              runId: payload.runId,
              seq: buffered.seq,
              message: payload.message!
            } as InstanceChatFinalEvent)
            break

          case 'error':
            this.sendToClient(client, {
              type: 'chat.error',
              sessionId: this.sessionId,
              runId: payload.runId,
              seq: buffered.seq,
              error: payload.errorMessage ?? 'Unknown error'
            } as InstanceChatErrorEvent)
            break
        }
      }
    }
  }

  private broadcastToClients(event: InstanceEvent): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, event)
    }
  }

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  private setState(state: InstanceState, error?: string): void {
    const oldState = this.state
    this.state = state
    this.error = error

    console.log('[SessionInstance] State changed', {
      sessionId: this.sessionId,
      oldState,
      newState: state,
      error
    })

    // Broadcast state change to clients
    this.broadcastToClients({
      type: 'state.changed',
      sessionId: this.sessionId,
      state,
      error
    } as InstanceStateChangedEvent)

    // Notify callbacks
    this.notifyEventCallbacks({
      type: 'state.changed',
      sessionId: this.sessionId,
      state,
      error
    } as InstanceStateChangedEvent)
  }

  // ========================================================================
  // IDLE TIMEOUT
  // ========================================================================

  private updateActivity(): void {
    this.lastActivityAt = new Date()
  }

  private scheduleIdleCheck(): void {
    this.clearIdleTimer()

    this.idleTimer = setTimeout(() => {
      this.checkIdle()
    }, this.idleTimeoutMinutes * 60 * 1000)
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private checkIdle(): void {
    const now = Date.now()
    const idleTime = now - this.lastActivityAt.getTime()
    const idleMinutes = idleTime / (60 * 1000)

    // Stop if idle for more than timeout and no clients
    if (idleMinutes >= this.idleTimeoutMinutes && this.clients.size === 0) {
      console.log('[SessionInstance] Idle timeout, stopping', {
        sessionId: this.sessionId,
        idleMinutes: idleMinutes.toFixed(2)
      })
      this.stop()
      return
    }

    // Reschedule if not stopping
    if (this.state !== 'stopped') {
      this.scheduleIdleCheck()
    }
  }

  // ========================================================================
  // EVENT CALLBACKS
  // ========================================================================

  onEvent(callback: (event: InstanceEvent) => void): () => void {
    this.onEventCallbacks.add(callback)
    return () => this.onEventCallbacks.delete(callback)
  }

  private notifyEventCallbacks(event: InstanceEvent): void {
    for (const callback of this.onEventCallbacks) {
      try {
        callback(event)
      } catch (error) {
        console.error('[SessionInstance] Event callback error:', error)
      }
    }
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private determineOrigin(): string {
    // Use environment variable if set
    if (process.env.CLAWHUB_ORIGIN) {
      return process.env.CLAWHUB_ORIGIN
    }

    // Parse gateway URL to construct matching origin
    const gatewayUrl = new URL(this.gatewayUrl)
    const protocol = gatewayUrl.protocol === 'wss:' ? 'https:' : 'http:'

    // If connecting to localhost, use localhost origin
    if (gatewayUrl.hostname === 'localhost' || gatewayUrl.hostname === '127.0.0.1') {
      return `${protocol}//localhost:18789`
    }

    // For remote connections, use the gateway host
    return `${protocol}//${gatewayUrl.host}`
  }

  /**
   * Get instance status for monitoring
   */
  getStatus() {
    return {
      sessionId: this.sessionId,
      agentId: this.agentId,
      sessionKey: this.sessionKey,
      gatewayId: this.gatewayId,
      state: this.state,
      clientCount: this.clients.size,
      currentSeq: this.eventBuffer.getLatestSeq(),
      connectedAt: this.connectedAt,
      lastActivityAt: this.lastActivityAt,
      error: this.error,
      bufferStats: this.eventBuffer.getStats()
    }
  }
}
