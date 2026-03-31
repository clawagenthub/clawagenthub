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
import { getSessionStatusTracker } from '@/lib/session/status-tracker'
import { randomUUID } from 'crypto'

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
  private readonly BUFFER_TTL = 3600000 // 1 hour
  private started = false

  /**
   * Start the service and initialize
   */
  start() {
    if (this.started) {
      return
    }

    this.started = true
    console.log('[StreamingChatService] Service started')

    // Periodic cleanup of old sessions
    setInterval(() => {
      this.cleanup()
    }, 60000) // Every minute
  }

  /**
   * Stop the service and cleanup
   */
  stop() {
    if (!this.started) {
      return
    }

    this.started = false

    // Stop all active streams
    for (const stream of this.sessions.values()) {
      if (stream.status === 'streaming') {
        this.stopStreaming(stream.streamId)
      }
    }

    console.log('[StreamingChatService] Service stopped')
  }

  /**
   * Start streaming for a chat session
   */
  async startStreaming(params: StartStreamingParams): Promise<{ streamId: string; runId?: string }> {
    const { sessionId, userId, workspaceId } = params

    // Check if session exists and belongs to user
    const db = getDatabase()
    const session = db.prepare(`
      SELECT * FROM chat_sessions 
      WHERE id = ? AND workspace_id = ?
    `).get(sessionId, workspaceId) as any

    if (!session) {
      throw new Error('Session not found')
    }

    // Check if already streaming
    const existing = Array.from(this.sessions.values())
      .find(s => s.sessionId === sessionId && s.status === 'streaming')
    
    if (existing) {
      console.log('[StreamingChatService] Session already streaming:', sessionId)
      return { streamId: existing.streamId, runId: existing.runId || undefined }
    }

    // Create new streaming session
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
    console.log('[StreamingChatService] Created streaming session:', { streamId, sessionId })

    // Subscribe to gateway events
    await this.subscribeToGatewayEvents(streamingSession)

    return { streamId }
  }

  /**
   * Subscribe to gateway events for this streaming session
   */
  private async subscribeToGatewayEvents(session: StreamingSession) {
    const manager = getGatewayManager()
    const client = manager.getClient(session.gatewayId)

    if (!client || !client.isConnected()) {
      session.status = 'error'
      console.error('[StreamingChatService] Gateway not connected for session:', session.sessionId)
      return
    }

    console.log('[StreamingChatService] Subscribing to gateway events for session:', session.sessionId)

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

      // Update runId from first event
      if (!session.runId && payload.runId) {
        session.runId = payload.runId
        console.log('[StreamingChatService] Got runId:', payload.runId)
      }

      // Update status based on event state
      if (payload.state === 'final' || payload.state === 'error') {
        session.status = 'stopped'
        console.log('[StreamingChatService] Stream completed:', session.sessionId)
      } else if (payload.state === 'delta') {
        session.status = 'streaming'
      }

      session.lastActivityAt = Date.now()

      // Broadcast to WebSocket clients
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

      // Broadcast to WebSocket clients
      this.broadcastEvent(session, streamEvent)
    })

    this.eventUnsubscribers.set(session.streamId, () => {
      chatUnsub()
      agentUnsub()
    })

    console.log('[StreamingChatService] Subscribed to gateway events for stream:', session.streamId)
  }

  /**
   * Broadcast event to WebSocket clients subscribed to this session
   */
  private broadcastEvent(session: StreamingSession, event: StreamEvent) {
    try {
      const wsManager = getWebSocketManager()
      
      // Transform event for browser clients
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
      console.error('[StreamingChatService] Failed to broadcast event:', error)
    }
  }

  /**
   * Buffer an event for reconnection
   */
  private bufferEvent(streamId: string, event: StreamEvent) {
    const session = this.sessions.get(`stream:${streamId}`)
    if (!session) return

    session.bufferedEvents.push(event)

    // Prune old events if buffer is too large
    if (session.bufferedEvents.length > this.BUFFER_SIZE) {
      session.bufferedEvents = session.bufferedEvents.slice(-this.BUFFER_SIZE)
    }

    // Remove events older than TTL
    const cutoff = Date.now() - this.BUFFER_TTL
    session.bufferedEvents = session.bufferedEvents.filter(e => e.timestamp > cutoff)
  }

  /**
   * Get buffered events for a session (for reconnection)
   */
  getBufferedEvents(streamId: string): StreamEvent[] {
    const session = this.sessions.get(`stream:${streamId}`)
    return session?.bufferedEvents || []
  }

  /**
   * Get buffered events by session ID (for reconnection)
   */
  getBufferedEventsBySessionId(sessionId: string): StreamEvent[] {
    const session = Array.from(this.sessions.values()).find(
      s => s.sessionId === sessionId
    )
    return session?.bufferedEvents || []
  }

  /**
   * Check if a session is actively streaming
   */
  isStreaming(sessionId: string): boolean {
    return Array.from(this.sessions.values()).some(
      s => s.sessionId === sessionId && s.status === 'streaming'
    )
  }

  /**
   * Get the stream ID for a session
   */
  getStreamId(sessionId: string): string | null {
    const session = Array.from(this.sessions.values()).find(
      s => s.sessionId === sessionId && s.status === 'streaming'
    )
    return session?.streamId || null
  }

  /**
   * Stop streaming for a session
   */
  stopStreaming(streamId: string): void {
    const key = `stream:${streamId}`
    const session = this.sessions.get(key)

    if (session) {
      console.log('[StreamingChatService] Stopping stream:', streamId)
      session.status = 'stopped'
      
      // Unsubscribe from events
      const unsub = this.eventUnsubscribers.get(streamId)
      if (unsub) {
        unsub()
        this.eventUnsubscribers.delete(streamId)
      }

      // Keep in sessions for a bit for reconnection, then cleanup
      setTimeout(() => {
        this.sessions.delete(key)
        console.log('[StreamingChatService] Cleaned up stream:', streamId)
      }, 60000) // Keep for 1 minute
    }
  }

  /**
   * Get status of all active streams
   */
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

  /**
   * Get stream info by stream ID
   */
  getStream(streamId: string): StreamingSession | undefined {
    return this.sessions.get(`stream:${streamId}`)
  }

  /**
   * Cleanup old sessions
   */
  private cleanup() {
    const now = Date.now()
    let cleaned = 0

    for (const [key, session] of this.sessions.entries()) {
      // Remove stopped sessions older than 1 hour
      if (session.status === 'stopped' && now - session.lastActivityAt > 3600000) {
        this.sessions.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log('[StreamingChatService] Cleaned up', cleaned, 'old streams')
    }
  }

  /**
   * Check if the service is running
   */
  isRunning(): boolean {
    return this.started
  }
}

// ============================================================================
// SINGLETON PATTERN
// ============================================================================
// IMPORTANT: This service is implemented as a singleton to ensure:
// 1. Only one instance exists server-side
// 2. All streaming sessions are tracked in a central place
// 3. Gateway subscriptions are managed efficiently (no duplicates)
// 4. Multiple API routes can access the same streaming sessions
//
// Usage: Always use getStreamingChatService() to access the service
// Never instantiate the class directly with 'new StreamingChatService()'
// ============================================================================

let serviceInstance: StreamingChatService | null = null

/**
 * Get the singleton instance of StreamingChatService
 * Always use this function to access the service - never instantiate directly.
 * 
 * @example
 * ```typescript
 * import { getStreamingChatService } from '@/lib/streaming/chat-service'
 * 
 * const service = getStreamingChatService()
 * await service.startStreaming({ sessionId, userId, workspaceId })
 * ```
 */
export function getStreamingChatService(): StreamingChatService {
  if (!serviceInstance) {
    serviceInstance = new StreamingChatService()
    serviceInstance.start()
    console.log('[StreamingChatService] Singleton instance created')
  }
  return serviceInstance
}

/**
 * Reset the singleton instance (useful for testing only)
 * In production, this should never be called.
 */
export function resetStreamingChatServiceForTest() {
  if (serviceInstance) {
    serviceInstance.stop()
    serviceInstance = null
    console.log('[StreamingChatService] Singleton instance reset')
  }
}
