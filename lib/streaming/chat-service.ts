/**
 * Server-Side Streaming Chat Service
 * 
 * This service manages active chat sessions on the server side, allowing:
 * - Chat streaming to continue even if the client disconnects
 * - Reconnection to active streams via buffered events
 * - Status tracking for all active sessions
 * 
 * IMPORTANT: This is a singleton service. Always use getStreamingChatService()
 * to access the service - never instantiate directly.
 */

import { getGatewayManager } from '@/lib/gateway/manager'
import { getDatabase } from '@/lib/db'
import { getWebSocketManager } from '@/lib/websocket/manager'
import { randomUUID } from 'crypto'
import logger, { logCategories } from '@/lib/logger/index.js'

export interface StreamEvent {
  type: 'delta' | 'final' | 'error' | 'agent' | 'lifecycle' | 'aborted'
  sessionId: string
  runId: string
  data: any
  timestamp: number
}

export interface StreamingSession {
  streamId: string
  sessionId: string
  sessionKey: string
  runId: string | null
  status: 'starting' | 'streaming' | 'error' | 'stopped'
  startedAt: number
  lastActivityAt: number
  bufferedEvents: StreamEvent[]
  userId: string
  gatewayId: string
}

export interface StreamStatus {
  streamId: string
  sessionId: string
  status: string
  startedAt: string
  lastActivity: string
}

interface StartStreamingParams {
  sessionId: string
  userId: string
  workspaceId: string
}

class StreamingChatService {
  private sessions: Map<string, StreamingSession> = new Map()
  private eventUnsubscribers: Map<string, () => void> = new Map()
  private readonly BUFFER_SIZE = 1000
  private readonly BUFFER_TTL = 3600000
  private started = false

  start() {
    if (this.started) {
      return
    }

    this.started = true
    logger.info({ category: logCategories.STREAMING }, 'Service started')
  }

  stop() {
    if (!this.started) {
      return
    }

    this.started = false

    for (const stream of this.sessions.values()) {
      if (stream.status === 'streaming') {
        this.stopStreaming(stream.streamId)
      }
    }

    logger.info({ category: logCategories.STREAMING }, 'Service stopped')
  }

  async startStreaming(params: StartStreamingParams): Promise<{ streamId: string; runId?: string }> {
    const { sessionId, userId, workspaceId } = params

    const db = getDatabase()
    const session = db.prepare(`
      SELECT * FROM chat_sessions 
      WHERE id = ? AND workspace_id = ?
    `).get(sessionId, workspaceId) as any

    if (!session) {
      throw new Error('Session not found')
    }

    const existing = Array.from(this.sessions.values())
      .find(s => s.sessionId === sessionId && s.status === 'streaming')
    
    if (existing) {
      logger.info({ category: logCategories.STREAMING }, 'Session %s already streaming', sessionId)
      return { streamId: existing.streamId, runId: existing.runId || undefined }
    }

    const streamId = randomUUID()
    const streamKey = `stream:${streamId}`

    const streamingSession: StreamingSession = {
      streamId,
      sessionId,
      sessionKey: session.session_key,
      runId: null,
      status: 'starting',
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      bufferedEvents: [],
      userId,
      gatewayId: session.gateway_id
    }

    this.sessions.set(streamKey, streamingSession)
    logger.info({ category: logCategories.STREAMING }, 'Created streaming session for %s', sessionId)

    await this.subscribeToGatewayEvents(streamingSession)

    return { streamId }
  }

  private async subscribeToGatewayEvents(session: StreamingSession) {
    const manager = getGatewayManager()
    const client = manager.getClient(session.gatewayId)

    if (!client || !client.isConnected()) {
      session.status = 'error'
      logger.error({ category: logCategories.STREAMING }, 'Gateway not connected for session %s', session.sessionId)
      return
    }

    logger.debug({ category: logCategories.STREAMING }, 'Subscribing to gateway events for session %s', session.sessionId)

    const chatUnsub = client.onEvent('chat', (event: any) => {
      const payload = event.payload || event
      if (payload.sessionKey !== session.sessionKey) return

      const streamEvent: StreamEvent = {
        type: payload.state || 'delta',
        sessionId: session.sessionId,
        runId: payload.runId || session.runId || '',
        data: payload,
        timestamp: Date.now()
      }

      this.bufferEvent(session.streamId, streamEvent)

      if (!session.runId && payload.runId) {
        session.runId = payload.runId
        logger.debug({ category: logCategories.STREAMING }, 'Got runId: %s', payload.runId)
      }

      if (payload.state === 'final' || payload.state === 'error') {
        session.status = 'stopped'
        logger.info({ category: logCategories.STREAMING }, 'Stream completed: %s', session.sessionId)
      } else if (payload.state === 'delta') {
        session.status = 'streaming'
      }

      session.lastActivityAt = Date.now()
      this.broadcastEvent(session, streamEvent)
    })

    const agentUnsub = client.onEvent('agent', (event: any) => {
      const payload = event.payload || event
      if (payload.sessionKey !== session.sessionKey) return

      const streamEvent: StreamEvent = {
        type: 'agent',
        sessionId: session.sessionId,
        runId: payload.runId || session.runId || '',
        data: payload,
        timestamp: Date.now()
      }

      this.bufferEvent(session.streamId, streamEvent)
      session.lastActivityAt = Date.now()
      this.broadcastEvent(session, streamEvent)
    })

    this.eventUnsubscribers.set(session.streamId, () => {
      chatUnsub()
      agentUnsub()
    })

    logger.debug({ category: logCategories.STREAMING }, 'Subscribed to gateway events for stream %s', session.streamId)
  }

  private broadcastEvent(session: StreamingSession, event: StreamEvent) {
    try {
      const wsManager = getWebSocketManager()
      
      const browserEvent = {
        type: event.type === 'delta' ? 'chat.delta' : 
              event.type === 'final' ? 'chat.final' :
              event.type === 'error' ? 'chat.error' :
              event.type === 'agent' ? 'agent' : 'chat.delta',
        sessionId: session.sessionId,
        data: event.data
      }

      wsManager.broadcast(session.sessionId, browserEvent)
    } catch (error) {
      logger.error({ category: logCategories.STREAMING }, 'Failed to broadcast event: %s', String(error))
    }
  }

  private bufferEvent(streamId: string, event: StreamEvent) {
    const session = this.sessions.get(`stream:${streamId}`)
    if (!session) return

    session.bufferedEvents.push(event)

    if (session.bufferedEvents.length > this.BUFFER_SIZE) {
      session.bufferedEvents = session.bufferedEvents.slice(-this.BUFFER_SIZE)
    }

    const cutoff = Date.now() - this.BUFFER_TTL
    session.bufferedEvents = session.bufferedEvents.filter(e => e.timestamp > cutoff)
  }

  getBufferedEvents(streamId: string): StreamEvent[] {
    const session = this.sessions.get(`stream:${streamId}`)
    return session?.bufferedEvents || []
  }

  getBufferedEventsBySessionId(sessionId: string): StreamEvent[] {
    const session = Array.from(this.sessions.values()).find(
      s => s.sessionId === sessionId
    )
    return session?.bufferedEvents || []
  }

  isStreaming(sessionId: string): boolean {
    return Array.from(this.sessions.values()).some(
      s => s.sessionId === sessionId && s.status === 'streaming'
    )
  }

  getStreamId(sessionId: string): string | null {
    const session = Array.from(this.sessions.values()).find(
      s => s.sessionId === sessionId && s.status === 'streaming'
    )
    return session?.streamId || null
  }

  stopStreaming(streamId: string): void {
    const key = `stream:${streamId}`
    const session = this.sessions.get(key)

    if (session) {
      logger.info({ category: logCategories.STREAMING }, 'Stopping stream %s', streamId)
      session.status = 'stopped'
      
      const unsub = this.eventUnsubscribers.get(streamId)
      if (unsub) {
        unsub()
        this.eventUnsubscribers.delete(streamId)
      }

      setTimeout(() => {
        this.sessions.delete(key)
        logger.debug({ category: logCategories.STREAMING }, 'Cleaned up stream %s', streamId)
      }, 60000)
    }
  }

  getActiveStreams(userId?: string): StreamStatus[] {
    return Array.from(this.sessions.values())
      .filter(s => !userId || s.userId === userId)
      .filter(s => s.status !== 'stopped')
      .map(s => ({
        streamId: s.streamId,
        sessionId: s.sessionId,
        status: s.status,
        startedAt: new Date(s.startedAt).toISOString(),
        lastActivity: new Date(s.lastActivityAt).toISOString()
      }))
  }

  getStream(streamId: string): StreamingSession | undefined {
    return this.sessions.get(`stream:${streamId}`)
  }

  private cleanup() {
    const now = Date.now()
    let cleaned = 0

    for (const [key, session] of this.sessions.entries()) {
      if (session.status === 'stopped' && now - session.lastActivityAt > 3600000) {
        this.sessions.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug({ category: logCategories.STREAMING }, 'Cleaned up %s old streams', cleaned)
    }
  }

  isRunning(): boolean {
    return this.started
  }
}

let serviceInstance: StreamingChatService | null = null

export function getStreamingChatService(): StreamingChatService {
  if (!serviceInstance) {
    serviceInstance = new StreamingChatService()
    serviceInstance.start()
    logger.info({ category: logCategories.STREAMING }, 'Singleton instance created')
  }
  return serviceInstance
}

export function resetStreamingChatServiceForTest() {
  if (serviceInstance) {
    serviceInstance.stop()
    serviceInstance = null
    logger.info({ category: logCategories.STREAMING }, 'Singleton instance reset')
  }
}
