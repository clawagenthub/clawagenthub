/**
 * Gateway Session Instance
 * A persistent server-side WebSocket connection to the OpenClaw Gateway.
 */

import WebSocket from 'ws'
import { randomUUID } from 'crypto'
import { EventBuffer } from './buffer.js'
import {
  determineOrigin,
  createGatewayConnection,
  closeConnection,
  isConnectionOpen,
} from './session-connection.js'
import {
  SessionEventManager,
  sendToClient,
  broadcastToClients,
} from './session-events.js'
import { IdleTimerManager } from './session-heartbeat.js'
import { SessionStateMachine } from './session-state-machine.js'
import { parseGatewayMessage } from './session-message-handlers.js'
import {
  persistMessage,
  persistAssistantMessage,
} from './session-persistence.js'
import type {
  RequestFrame,
  ChatEventPayload,
  InstanceEvent,
  InstanceState,
  InstanceStateChangedEvent,
  InstanceChatDeltaEvent,
  InstanceChatFinalEvent,
  InstanceChatErrorEvent,
  InstanceConnectedEvent,
  InstanceErrorEvent,
  InstanceAgentTypingEvent,
} from './protocol.js'
import type {
  ClientConnection,
  SessionInstanceOptions,
  PendingRequest,
  ClientMessage,
  SessionStatus,
} from './session-types.js'

export class GatewaySessionInstance {
  private readonly sessionId: string
  private readonly agentId: string
  private readonly sessionKey: string
  private readonly gatewayId: string
  private readonly gatewayUrl: string
  private readonly authToken: string
  private readonly origin?: string

  private readonly stateMachine: SessionStateMachine
  private error?: string
  private connectedAt?: Date

  private gatewayWs: WebSocket | null = null
  private gatewayAuthenticated = false
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connectResolve?: () => void
  private connectReject?: (err: Error) => void

  private eventBuffer: EventBuffer
  private clients: Map<string, ClientConnection> = new Map()
  private readonly eventManager: SessionEventManager
  private readonly idleTimer: IdleTimerManager

  constructor(options: SessionInstanceOptions) {
    this.sessionId = options.sessionId
    this.agentId = options.agentId
    this.sessionKey = options.sessionKey ?? `agent:${this.agentId}:main`
    this.gatewayId = options.gateway.id
    this.gatewayUrl = options.gateway.url
    this.authToken = options.gateway.authToken
    this.origin = options.origin

    this.stateMachine = new SessionStateMachine(this.sessionId)
    this.eventBuffer = new EventBuffer({ maxSize: 1000, ttlMs: 5 * 60 * 1000 })
    this.eventManager = new SessionEventManager()
    this.idleTimer = new IdleTimerManager({
      idleTimeoutMinutes: options.idleTimeout ?? 30,
      onIdle: () => this.stop(),
    })

    console.log('[SessionInstance] Created', {
      sessionId: this.sessionId,
      agentId: this.agentId,
      sessionKey: this.sessionKey,
      gatewayId: this.gatewayId,
    })
  }

  async start(): Promise<void> {
    if (this.stateMachine.isActive()) {
      console.log('[SessionInstance] Already connected/connecting', {
        sessionId: this.sessionId,
        state: this.stateMachine.state,
      })
      return
    }
    console.log('[SessionInstance] Starting', {
      sessionId: this.sessionId,
      sessionKey: this.sessionKey,
    })
    this.stateMachine.transition('connecting')
    await this.connectToGateway()
    this.idleTimer.schedule()
  }

  stop(): void {
    console.log('[SessionInstance] Stopping', { sessionId: this.sessionId })
    this.stateMachine.transition('stopped')
    this.disconnectFromGateway()
    this.idleTimer.clear()
    this.clearReconnectTimer()
  }

  isActive(): boolean {
    return this.stateMachine.isActive()
  }
  getState(): InstanceState {
    return this.stateMachine.state
  }

  addClient(
    clientId: string,
    ws: WebSocket,
    userId: string,
    sinceSeq?: number
  ): void {
    const client: ClientConnection = {
      id: clientId,
      ws,
      userId,
      connectedAt: new Date(),
      lastSeq: sinceSeq,
    }
    this.clients.set(clientId, client)
    this.idleTimer.updateActivity()
    console.log('[SessionInstance] Client added', {
      sessionId: this.sessionId,
      clientId,
      userId,
      clientCount: this.clients.size,
    })

    if (sinceSeq !== undefined) this.sendBufferedEvents(client)
    sendToClient(client, {
      type: 'connected',
      sessionId: this.sessionId,
      currentSeq: this.eventBuffer.getLatestSeq(),
    } as InstanceConnectedEvent)
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) return
    this.clients.delete(clientId)
    console.log('[SessionInstance] Client removed', {
      sessionId: this.sessionId,
      clientId,
      remainingClients: this.clients.size,
    })
    if (this.clients.size === 0) this.idleTimer.schedule()
  }

  getClientCount(): number {
    return this.clients.size
  }

  async handleClientMessage(
    clientId: string,
    message: ClientMessage
  ): Promise<void> {
    const client = this.clients.get(clientId)
    if (!client) {
      console.warn('[SessionInstance] Client not found for message', {
        sessionId: this.sessionId,
        clientId,
      })
      return
    }
    this.idleTimer.updateActivity()
    switch (message.type) {
      case 'chat.send':
        await this.sendChatMessage(message.content, message.options)
        break
      case 'chat.abort':
        await this.abortChat(message.runId)
        break
      case 'ping':
        sendToClient(client, {
          type: 'pong',
          sessionId: this.sessionId,
          timestamp: Date.now(),
        })
        break
    }
  }

  private async connectToGateway(): Promise<void> {
    const origin = this.origin || determineOrigin(this.gatewayUrl)
    console.log('[SessionInstance] Connecting to gateway', {
      sessionId: this.sessionId,
      url: this.gatewayUrl,
      origin,
    })

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve
      this.connectReject = reject

      const callbacks = {
        onOpen: () =>
          console.log('[SessionInstance] Gateway WebSocket opened', {
            sessionId: this.sessionId,
          }),
        onMessage: (data: WebSocket.Data) => {
          const parsed = parseGatewayMessage(data)
          if (parsed) this.onGatewayMessage(parsed)
        },
        onClose: () => {
          console.log('[SessionInstance] Gateway WebSocket closed', {
            sessionId: this.sessionId,
          })
          this.gatewayAuthenticated = false
          this.stateMachine.transition('disconnected')
          this.scheduleReconnect()
        },
        onError: (err: Error) => {
          console.error('[SessionInstance] Gateway WebSocket error:', err)
          if (!this.gatewayAuthenticated) reject(err)
        },
      }

      const connectTimeout = setTimeout(() => {
        reject(new Error('Gateway connection timeout (10s)'))
        this.gatewayWs?.close()
      }, 10000)
      const { ws } = createGatewayConnection(
        this.gatewayUrl,
        origin,
        callbacks,
        10000
      )
      this.gatewayWs = ws
      this.onChallenge = (nonce?: string) => {
        clearTimeout(connectTimeout)
        this.sendConnectRequest(nonce)
      }
    })
  }

  private onChallenge?: (nonce?: string) => void

  private sendConnectRequest(nonce?: string): void {
    this.sendToGateway({
      type: 'req',
      id: 'connect',
      method: 'connect',
      params: { token: this.authToken, nonce },
    })
  }

  private onGatewayMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'event') {
      const evt = msg as unknown as {
        event: string
        payload?: unknown
        seq?: number
      }
      if (evt.event === 'connect.challenge') {
        this.onChallenge?.(
          (evt.payload as { nonce?: string } | undefined)?.nonce
        )
        return
      }
      if (evt.event === 'chat') {
        this.handleChatEvent(
          evt as unknown as {
            event: string
            payload: ChatEventPayload
            seq?: number
          }
        )
        return
      }
      if (evt.event === 'agent') {
        this.handleAgentEvent(
          evt as unknown as {
            event: string
            payload: { agentId: string; isTyping?: boolean }
            seq?: number
          }
        )
        return
      }
      this.bufferEvent(
        evt as unknown as { event: string; payload: unknown; seq?: number }
      )
      return
    }

    if (msg.type === 'res') {
      const res = msg as unknown as {
        id: string
        ok: boolean
        payload?: unknown
        error?: { message?: string }
      }
      const pending = this.pendingRequests.get(res.id)
      if (!pending) return
      this.pendingRequests.delete(res.id)
      clearTimeout(pending.timeout)
      res.ok
        ? pending.resolve(res.payload)
        : pending.reject(
            new Error(res.error?.message ?? 'Unknown gateway error')
          )
      if (res.id === 'connect') {
        this.gatewayAuthenticated = true
        this.connectedAt = new Date()
        this.stateMachine.transition('connected')
        console.log('[SessionInstance] Connected to gateway', {
          sessionId: this.sessionId,
        })
        this.connectResolve?.()
      }
    }
  }

  private disconnectFromGateway(): void {
    this.clearReconnectTimer()
    closeConnection(this.gatewayWs)
    this.gatewayWs = null
    this.gatewayAuthenticated = false
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.stateMachine.isStopped()) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.stateMachine.isStopped())
        this.connectToGateway().catch(() => {})
    }, 3000)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private handleChatEvent(frame: {
    event: string
    payload: ChatEventPayload
    seq?: number
  }): void {
    const { payload, seq: frameSeq } = frame
    const seq = this.eventBuffer.add('chat', payload, frameSeq)
    this.idleTimer.updateActivity()

    switch (payload.state) {
      case 'delta':
        broadcastToClients(this.clients, {
          type: 'chat.delta',
          sessionId: this.sessionId,
          runId: payload.runId,
          seq,
          delta: payload.message?.content ?? '',
        } as InstanceChatDeltaEvent)
        break
      case 'final':
        persistAssistantMessage(
          this.sessionId,
          payload.runId,
          payload.message?.content ?? ''
        )
        broadcastToClients(this.clients, {
          type: 'chat.final',
          sessionId: this.sessionId,
          runId: payload.runId,
          seq,
          message: payload.message!,
        } as InstanceChatFinalEvent)
        break
      case 'error':
        broadcastToClients(this.clients, {
          type: 'chat.error',
          sessionId: this.sessionId,
          runId: payload.runId,
          seq,
          error: payload.errorMessage ?? 'Unknown error',
        } as InstanceChatErrorEvent)
        break
    }
  }

  private handleAgentEvent(frame: {
    event: string
    payload: { agentId: string; isTyping?: boolean }
    seq?: number
  }): void {
    const { payload } = frame
    this.bufferEvent(frame)
    broadcastToClients(this.clients, {
      type: 'agent.typing',
      sessionId: this.sessionId,
      agentId: payload.agentId ?? this.agentId,
      isTyping: payload.isTyping ?? true,
    } as InstanceAgentTypingEvent)
  }

  private bufferEvent(frame: {
    event: string
    payload?: unknown
    seq?: number
  }): void {
    this.eventBuffer.add(frame.event, frame.payload, frame.seq)
  }

  private callGateway(
    method: string,
    params?: unknown,
    timeoutMs = 30000
  ): Promise<unknown> {
    if (!isConnectionOpen(this.gatewayWs))
      throw new Error('Gateway not connected')
    const id = randomUUID()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Gateway request timeout: ${method}`))
      }, timeoutMs)
      this.pendingRequests.set(id, { resolve, reject, timeout })
      try {
        this.gatewayWs!.send(
          JSON.stringify({ type: 'req', id, method, params })
        )
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequests.delete(id)
        reject(error)
      }
    })
  }

  private sendToGateway(frame: RequestFrame): void {
    if (!isConnectionOpen(this.gatewayWs)) {
      this.connectReject?.(new Error('Gateway not connected'))
      return
    }
    try {
      this.gatewayWs!.send(JSON.stringify(frame))
    } catch (error) {
      this.connectReject?.(
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  private async sendChatMessage(
    content: string,
    options?: Record<string, unknown>
  ): Promise<void> {
    console.log('[SessionInstance] Sending chat message', {
      sessionId: this.sessionId,
      sessionKey: this.sessionKey,
      contentLength: content.length,
      hasAttachments: Boolean(options?.attachments),
      attachmentsCount: options?.attachments
        ? (options.attachments as any[]).length
        : 0,
    })

    try {
      const result = (await this.callGateway('chat.send', {
        sessionKey: this.sessionKey,
        message: content,
        idempotencyKey: randomUUID(),
        thinking: options?.thinking,
        deliver: options?.deliver ?? true,
        attachments: options?.attachments,
      })) as { runId: string; status: string }
      console.log('[SessionInstance] Chat message sent', {
        sessionId: this.sessionId,
        runId: result.runId,
        status: result.status,
      })
      persistMessage({
        sessionId: this.sessionId,
        content,
        role: 'user',
        runId: result.runId,
      })
    } catch (error) {
      console.error('[SessionInstance] Failed to send chat message:', error)
      broadcastToClients(this.clients, {
        type: 'error',
        sessionId: this.sessionId,
        error:
          error instanceof Error ? error.message : 'Failed to send message',
      } as InstanceErrorEvent)
      throw error
    }
  }

  private async abortChat(runId: string): Promise<void> {
    console.log('[SessionInstance] Aborting chat', {
      sessionId: this.sessionId,
      runId,
    })
    try {
      await this.callGateway('chat.abort', { runId })
    } catch (error) {
      console.error('[SessionInstance] Failed to abort chat:', error)
    }
  }

  private sendBufferedEvents(client: ClientConnection): void {
    const events = this.eventBuffer.getSince(client.lastSeq ?? 0)
    for (const event of events) {
      const buffered = event as {
        event: string
        payload: ChatEventPayload
        seq: number
      }
      if (buffered.event === 'chat') {
        const payload = buffered.payload
        switch (payload.state) {
          case 'delta':
            sendToClient(client, {
              type: 'chat.delta',
              sessionId: this.sessionId,
              runId: payload.runId,
              seq: buffered.seq,
              delta: payload.message?.content ?? '',
            } as InstanceChatDeltaEvent)
            break
          case 'final':
            sendToClient(client, {
              type: 'chat.final',
              sessionId: this.sessionId,
              runId: payload.runId,
              seq: buffered.seq,
              message: payload.message!,
            } as InstanceChatFinalEvent)
            break
          case 'error':
            sendToClient(client, {
              type: 'chat.error',
              sessionId: this.sessionId,
              runId: payload.runId,
              seq: buffered.seq,
              error: payload.errorMessage ?? 'Unknown error',
            } as InstanceChatErrorEvent)
            break
        }
      }
    }
  }

  private setState(state: InstanceState, error?: string): void {
    const { state: newState } = this.stateMachine.transition(state, error)
    this.error = error
    const event: InstanceStateChangedEvent = {
      type: 'state.changed',
      sessionId: this.sessionId,
      state: newState,
      error,
    }
    broadcastToClients(this.clients, event)
    this.eventManager.notify(event)
  }

  onEvent(callback: (event: InstanceEvent) => void): () => void {
    return this.eventManager.onEvent(callback)
  }

  getStatus(): SessionStatus {
    return {
      sessionId: this.sessionId,
      agentId: this.agentId,
      sessionKey: this.sessionKey,
      gatewayId: this.gatewayId,
      state: this.stateMachine.state,
      clientCount: this.clients.size,
      currentSeq: this.eventBuffer.getLatestSeq(),
      connectedAt: this.connectedAt,
      lastActivityAt: this.idleTimer.getLastActivityAt(),
      error: this.error,
      bufferStats: this.eventBuffer.getStats(),
    }
  }
}
