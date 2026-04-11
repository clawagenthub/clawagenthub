import WebSocket from 'ws'
import { randomUUID } from 'crypto'
import logger, { logCategories } from '@/lib/logger/index.js'

// --- Types ---

export interface GatewayAgent {
  id: string
  name?: string
  model?: string
  status?: string
  sessionKey?: string
}

export interface GatewayStatus {
  version?: string
  uptime?: number
  agents?: GatewayAgent[]
}

export interface HealthStatus {
  ok: boolean
  message?: string
}

/** Session message from gateway sessions.get response */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  metadata?: Record<string, unknown>
}

/** Response from gateway sessions.get method */
export interface SessionGetResponse {
  messages: SessionMessage[]
  sessionKey?: string
  sessionId?: string
}

type EventCallback = (data: unknown) => void

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timeout: ReturnType<typeof setTimeout>
}

// Gateway protocol frame types
interface EventFrame {
  type: 'event'
  event: string
  seq?: number
  payload?: unknown
}

interface ResponseFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { message?: string; code?: number }
}

interface RequestFrame {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

// --- Client ---

export class GatewayClient {
  private ws: WebSocket | null = null
  private url: string
  private authToken: string
  private origin?: string
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private eventListeners: Map<string, Set<EventCallback>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connected = false
  private authenticated = false
  private connectResolve?: () => void
  private connectReject?: (err: Error) => void

  constructor(
    url = 'ws://127.0.0.1:18789',
    opts: { authToken: string; origin?: string }
  ) {
    this.url = url
    this.authToken = opts.authToken
    this.origin = opts.origin

    if (!this.authToken) {
      throw new Error('Auth token is required for gateway connection')
    }

    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Initializing with token auth (url=%s, hasAuthToken=%s)', this.url, !!this.authToken)
  }

  // --- Connection with proper Gateway protocol ---

  async connect(): Promise<void> {
    if (this.authenticated && this.ws?.readyState === WebSocket.OPEN) return

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve
      this.connectReject = reject

      try {
        // Determine origin to use for WebSocket connection
        const origin = this.origin || this.determineOrigin()
        logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Connecting with origin: %s', origin)

        this.ws = new WebSocket(this.url, {
          maxPayload: 25 * 1024 * 1024,
          headers: {
            Origin: origin,
          },
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }

      const connectTimeout = setTimeout(() => {
        reject(new Error('Gateway connection timeout (10s)'))
        this.ws?.close()
      }, 10000)

      this.ws.on('open', () => {
        logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'WebSocket connection opened (url=%s)', this.url)
        this.connected = true
        // Wait for connect.challenge event from server
      })

      this.ws.on('message', (raw: WebSocket.Data) => {
        try {
          const parsed = JSON.parse(raw.toString())
          // console.warn('[GatewayClient] Received message', {
          //   type: parsed.type,
          //   event: parsed.event || 'N/A',
          //   id: parsed.id || 'N/A'
          // })
          this.handleMessage(parsed, connectTimeout)
        } catch (error) {
          logger.error({ category: logCategories.GATEWAY_CLIENT }, 'Failed to parse message: %s', error)
        }
      })

      this.ws.on('close', () => {
        logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'WebSocket connection closed (url=%s, wasAuthenticated=%s)', this.url, this.authenticated)
        this.connected = false
        this.authenticated = false
        clearTimeout(connectTimeout)
        this.scheduleReconnect()
      })

      this.ws.on('error', (err) => {
        logger.error({ category: logCategories.GATEWAY_CLIENT }, 'WebSocket error: %s', err)
        clearTimeout(connectTimeout)
        if (!this.authenticated) {
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      })
    })
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    this.authenticated = false
  }

  isConnected(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Check if the client is authenticated with the gateway
   */
  isAuthenticated(): boolean {
    return this.authenticated
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch(() => {})
    }, 3000)
  }

  /**
   * Determine origin to use for WebSocket connection
   * Priority: explicit option > environment variable > auto-detect from URL
   */
  private determineOrigin(): string {
    // Use environment variable if set
    if (process.env.CLAWHUB_ORIGIN) {
      return process.env.CLAWHUB_ORIGIN
    }

    // Parse gateway URL to construct matching origin
    const gatewayUrl = new URL(this.url)
    const protocol = gatewayUrl.protocol === 'wss:' ? 'https:' : 'http:'

    // If connecting to localhost, use localhost origin
    if (
      gatewayUrl.hostname === 'localhost' ||
      gatewayUrl.hostname === '127.0.0.1'
    ) {
      return `${protocol}//localhost:18789`
    }

    // For remote connections, use the gateway host
    return `${protocol}//${gatewayUrl.host}`
  }

  // --- Protocol handling ---

  private handleMessage(
    msg: Record<string, unknown>,
    connectTimeout?: ReturnType<typeof setTimeout>
  ): void {
    // Event frame
    if (msg.type === 'event') {
      const evt = msg as unknown as EventFrame

      // Handle connect.challenge - send connect request
      if (evt.event === 'connect.challenge') {
        const payload = evt.payload as { nonce?: string } | undefined
        const nonce = payload?.nonce
        logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Received connect.challenge (nonce=%s)', nonce || 'none')
        this.sendConnectRequest(nonce, connectTimeout)
        return
      }

      // Broadcast to event listeners
      const listeners = this.eventListeners.get(evt.event)
      if (listeners && listeners.size > 0) {
        logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Broadcasting event (event=%s, hasPayload=%s, listenerCount=%s)', evt.event, !!evt.payload, listeners.size)
        for (const cb of listeners) {
          try {
            cb(evt.payload ?? evt)
          } catch {
            /* ignore */
          }
        }
      }
      const wildcardListeners = this.eventListeners.get('*')
      if (wildcardListeners) {
        for (const cb of wildcardListeners) {
          try {
            cb({ event: evt.event, payload: evt.payload, seq: evt.seq })
          } catch {
            /* ignore */
          }
        }
      }
      return
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
        logger.error({ category: logCategories.GATEWAY_CLIENT }, 'Response error (id=%s, error=%s)', res.id, res.error)
        pending.reject(new Error(res.error?.message ?? 'Unknown gateway error'))
      }
    }
  }

  private sendConnectRequest(
    nonce?: string,
    connectTimeout?: ReturnType<typeof setTimeout>
  ): void {
    const id = randomUUID()

    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Sending connect request with token auth')

    const frame: RequestFrame = {
      type: 'req',
      id,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control-ui',
          displayName: 'ClawAgentHub Dashboard',
          version: '1.0.0',
          platform: 'web',
          mode: 'webchat',
        },
        caps: [],
        auth: { token: this.authToken },
        role: 'operator',
        scopes: ['operator.admin'],
      },
    }

    // Register pending for the connect response
    const pending: PendingRequest = {
      resolve: () => {
        if (connectTimeout) clearTimeout(connectTimeout)
        this.authenticated = true
        logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Successfully authenticated')
        this.connectResolve?.()
      },
      reject: (err: unknown) => {
        if (connectTimeout) clearTimeout(connectTimeout)
        this.connectReject?.(
          err instanceof Error ? err : new Error(String(err))
        )
      },
      timeout: setTimeout(() => {
        this.pendingRequests.delete(id)
        this.connectReject?.(new Error('Connect handshake timeout'))
      }, 10000),
    }

    this.pendingRequests.set(id, pending)
    this.ws?.send(JSON.stringify(frame))
  }

  // --- JSON-RPC calls ---

  async call(
    method: string,
    params?: unknown,
    timeoutMs = 30000
  ): Promise<unknown> {
    if (!this.isConnected()) {
      await this.connect()
    }

    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'RPC call (method=%s, hasParams=%s)', method, !!params)

    const id = randomUUID()
    const frame: RequestFrame = {
      type: 'req',
      id,
      method,
      params: params ?? {},
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        logger.error({ category: logCategories.GATEWAY_CLIENT }, 'RPC timeout (method=%s, timeoutMs=%s)', method, timeoutMs)
        reject(new Error(`RPC timeout: ${method}`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timeout })
      this.ws!.send(JSON.stringify(frame))
    })
  }

  // --- Events ---

  onEvent(type: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set())
    }
    this.eventListeners.get(type)!.add(callback)
    return () => {
      this.eventListeners.get(type)?.delete(callback)
    }
  }

  // --- Gateway-specific methods ---

  async status(): Promise<GatewayStatus> {
    return (await this.call('status', {})) as GatewayStatus
  }

  async health(): Promise<HealthStatus> {
    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Calling health() RPC method')
    try {
      const result = await this.call('health', {})
      logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'health() response: %s', result)
      return result as HealthStatus
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_CLIENT }, 'Error calling health(): %s', error)
      throw error
    }
  }

  async listAgents(): Promise<GatewayAgent[]> {
    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Calling agents.list RPC method')
    try {
      const result = (await this.call('agents.list', {})) as {
        agents?: GatewayAgent[]
      }
      logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'agents.list response (hasAgents=%s, agentCount=%s)', !!result?.agents, result?.agents?.length ?? 0)
      return result?.agents ?? []
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_CLIENT }, 'Error calling agents.list: %s', error)
      throw error
    }
  }

  // --- Chat/Agent messaging methods ---

  /**
   * Send a message to an agent via chat.send (OpenClaw v3.2+)
   * @param sessionKey Format: agent:{agentId}:main
   * @param message Message text (simple string)
   * @param options Optional parameters
   * @returns Promise with runId and status
   */
  async sendChatMessage(
    sessionKey: string,
    message: string,
    options?: {
      thinking?: string
      deliver?: boolean
      timeoutMs?: number
      idempotencyKey?: string
    }
  ): Promise<{ runId: string; status: string }> {
    const idempotencyKey = options?.idempotencyKey || randomUUID()

    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Sending chat message (sessionKey=%s, messageLength=%s)', sessionKey, message.length)

    const result = await this.call('chat.send', {
      sessionKey,
      message,
      idempotencyKey,
      thinking: options?.thinking,
      deliver: options?.deliver,
      timeoutMs: options?.timeoutMs,
    })

    return result as { runId: string; status: string }
  }

  /**
   * Send a message and wait for the agent's response
   * @param sessionKey Format: agent:{agentId}:main
   * @param message Message text
   * @param options Optional parameters
   * @returns Promise with runId and message or error
   */
  async sendChatMessageAndWait(
    sessionKey: string,
    message: string,
    options?: {
      thinking?: string
      deliver?: boolean
      timeoutMs?: number
      idempotencyKey?: string
    }
  ): Promise<{
    runId: string
    message?: unknown
    error?: string
  }> {
    const timeoutMs = options?.timeoutMs || 120000
    const { runId } = await this.sendChatMessage(sessionKey, message, options)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Chat response timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      const cleanup = this.onEvent('chat', (event: any) => {
        if (event.runId !== runId) return

        if (event.state === 'final') {
          clearTimeout(timeout)
          cleanup()
          resolve({
            runId,
            message: event.message,
          })
        } else if (event.state === 'error') {
          clearTimeout(timeout)
          cleanup()
          resolve({
            runId,
            error: event.errorMessage || 'Unknown error',
          })
        }
        // Ignore 'delta' events for now
      })
    })
  }

  /**
   * @deprecated Use sendChatMessage instead. This method is kept for backward compatibility.
   * Send a message to an agent (legacy method)
   */
  async sendAgentMessage(
    sessionKey: string,
    message: string,
    _metadata?: {
      label?: string
      id?: string
    }
  ): Promise<unknown> {
    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'sendAgentMessage is deprecated, use sendChatMessage or sendChatMessageAndWait')
    const result = await this.sendChatMessageAndWait(sessionKey, message)
    if (result.error) {
      throw new Error(result.error)
    }
    return result.message
  }

  /**
   * Get session history for an agent (OpenClaw v3.2 protocol)
   * Uses sessions.get method to retrieve message history
   * @param sessionKey Format: agent:{agentId}:main or session key
   * @returns Promise with SessionGetResponse containing messages array
   */
  async getSessionHistory(sessionKey: string): Promise<SessionGetResponse> {
    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Getting session history (sessionKey=%s)', sessionKey)

    // OpenClaw v3.2 uses 'chat.history' method for session history
    const result = (await this.call('chat.history', {
      sessionKey: sessionKey,
    })) as SessionGetResponse | undefined

    logger.warn({ category: logCategories.GATEWAY_CLIENT }, 'Session history response (hasMessages=%s, messageCount=%s)', !!result?.messages, result?.messages?.length ?? 0)

    // Return empty messages array if result is undefined
    return result ?? { messages: [] }
  }

  /**
   * List all available sessions
   */
  async listSessions(): Promise<unknown> {
    return await this.call('sessions.list', {})
  }
}
