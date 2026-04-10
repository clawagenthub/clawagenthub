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
import {
  buildAgentTypingEvent,
  sendConnectedEvent,
  broadcastErrorEvent,
  handleChatPayloadState,
  sendBufferedChatEventsToClient,
} from './session-instance-chat-events.js'
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
} from './protocol.js'
import logger, { logCategories } from '@/lib/logger/index.js'
import type {
  ClientConnection,
  SessionInstanceOptions,
  PendingRequest,
  ClientMessage,
  SessionStatus,
} from './session-types.js'
import { createStateChangedEvent, extractBufferedEvents } from './session-instance-types.js'

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

    logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Created: %s %s %s %s', this.sessionId, this.agentId, this.sessionKey, this.gatewayId)
  }

  async start(): Promise<void> {
    if (this.stateMachine.isActive()) {
      logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Already connected/connecting: %s %s', this.sessionId, this.state)
      return
    }
    logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Starting: %s %s', this.sessionId, this.sessionKey)
    this.stateMachine.transition('connecting')
    await this.connectToGateway()
    this.idleTimer.schedule()
  }

  stop(): void {
    logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Stopping: %s', this.sessionId)
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
    logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Client added: %s %s', this.sessionId, this.clients.size)

    if (sinceSeq !== undefined) this.sendBufferedEvents(client)
    sendConnectedEvent(client, this.sessionId, this.eventBuffer.getLatestSeq())
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) return
    this.clients.delete(clientId)
    logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Client removed: %s %s', this.sessionId, this.clients.size)
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
      logger.warn(
        { category: logCategories.GATEWAY_INSTANCE },
        '[SessionInstance] Client not found for message: %s',
        sessionId
      )
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
    logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Connecting to gateway: %s %s', this.sessionId, url)

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve
      this.connectReject = reject

      const callbacks = {
        onOpen: () => {
          logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Gateway WebSocket opened: %s', this.sessionId)
        },
        onMessage: (data: WebSocket.Data) => {
          const parsed = parseGatewayMessage(data)
          if (parsed) this.onGatewayMessage(parsed)
        },
        onClose: () => {
          logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Gateway WebSocket closed: %s', this.sessionId)
          this.gatewayAuthenticated = false
          this.stateMachine.transition('disconnected')
          this.scheduleReconnect()
        },
        onError: (err: Error) => {
          logger.error({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Gateway WebSocket error: %s', String(err))
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
        logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Connected to gateway: %s', this.sessionId)
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

    if (payload.state === 'final') {
      persistAssistantMessage(
        this.sessionId,
        payload.runId,
        payload.message?.content ?? ''
      )
    }

    handleChatPayloadState(this.clients, this.sessionId, payload, seq)
  }

  private handleAgentEvent(frame: {
    event: string
    payload: { agentId: string; isTyping?: boolean }
    seq?: number
  }): void {
    const { payload } = frame
    this.bufferEvent(frame)
    buildAgentTypingEvent(
      this.clients,
      this.sessionId,
      payload.agentId ?? this.agentId,
      payload.isTyping ?? true
    )
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
    logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Sending chat message: %s %s %s %s %s', this.sessionId, this.sessionKey, contentLength, hasAttachments, attachmentsCount)

    try {
      const result = (await this.callGateway('chat.send', {
        sessionKey: this.sessionKey,
        message: content,
        idempotencyKey: randomUUID(),
        thinking: options?.thinking,
        deliver: options?.deliver ?? true,
        attachments: options?.attachments,
      })) as { runId: string; status: string }
      logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Chat message sent: %s %s %s', this.sessionId, runId, status)
      persistMessage({
        sessionId: this.sessionId,
        content,
        role: 'user',
        runId: result.runId,
      })
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Failed to send chat message: %s', String(error))
      broadcastErrorEvent(
        this.clients,
        this.sessionId,
        error instanceof Error ? error.message : 'Failed to send message'
      )
      throw error
    }
  }

  private async abortChat(runId: string): Promise<void> {
    logger.debug({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Aborting chat: %s', this.sessionId)
    try {
      await this.callGateway('chat.abort', { runId })
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_INSTANCE }, '[SessionInstance] Failed to abort chat: %s', String(error))
    }
  }

  private sendBufferedEvents(client: ClientConnection): void {
    const events = extractBufferedEvents(client, this.eventBuffer)
    sendBufferedChatEventsToClient(client, this.sessionId, events)
  }

  private setState(state: InstanceState, error?: string): void {
    const { state: newState } = this.stateMachine.transition(state, error)
    this.error = error
    const event = createStateChangedEvent(this.sessionId, newState, error)
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
