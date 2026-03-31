# Chat Streaming Fixes - Implementation Guide

## Summary

This document provides specific implementation steps to fix the three main issues:

1. **useEffect infinite loop** causing tab to switch back to chat
2. **Chat stops on navigation** - streaming should continue server-side
3. **Messages not saved** - last messages lost when navigating away

## Important: Singleton Pattern

The `StreamingChatService` is implemented as a **singleton class**. This ensures:
- Only one instance exists server-side
- Shared state across all API routes
- Consistent session management
- No duplicate subscriptions to gateway events

Usage pattern:
```typescript
import { getStreamingChatService } from '@/lib/streaming/chat-service'

// Always use this function to get the singleton instance
const service = getStreamingChatService()
```

---

## Part 1: Fix useEffect Infinite Loop (Critical - Immediate Fix)

### Fix 1.1: enhanced-chat-container.tsx

**Problem**: `queryClient` in dependency array causes re-renders.

**Location**: [`components/chat/enhanced-chat-container.tsx`](../components/chat/enhanced-chat-container.tsx:22-29)

**Current Code**:
```tsx
// Refetch sessions when switching to sessions tab
useEffect(() => {
  if (activeTab === 'sessions' && previousTabRef.current !== 'sessions') {
    console.log('[EnhancedChatContainer] Switching to sessions tab - refetching sessions')
    queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
  }
  previousTabRef.current = activeTab
}, [activeTab, queryClient])  // <-- queryClient causes re-render loop
```

**Fix**:
```tsx
// Refetch sessions when switching to sessions tab
useEffect(() => {
  if (activeTab === 'sessions' && previousTabRef.current !== 'sessions') {
    console.log('[EnhancedChatContainer] Switching to sessions tab - refetching sessions')
    queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
  }
  previousTabRef.current = activeTab
}, [activeTab])  // Remove queryClient from dependencies
```

### Fix 1.2: useChatWebSocket.ts

**Problem**: The `connect` callback changes on every render due to dependency on `sessionId` and `onMessage`.

**Location**: [`lib/hooks/useChatWebSocket.ts`](../lib/hooks/useChatWebSocket.ts:145-154)

**Current Code**:
```tsx
// Connect on mount
useEffect(() => {
  if (enabled) {
    connect()
  }

  return () => {
    disconnect()
  }
}, [enabled, connect, disconnect])  // connect changes every render
```

**Fix**: Use `useRef` for stable references:
```tsx
const sessionIdRef = useRef(sessionId)
const onMessageRef = useRef(onMessage)

// Update refs when values change
useEffect(() => {
  sessionIdRef.current = sessionId
  onMessageRef.current = onMessage
}, [sessionId, onMessage])

const connect = useCallback(() => {
  // Use refs instead of closure values
  const currentSessionId = sessionIdRef.current
  const currentOnMessage = onMessageRef.current
  // ... rest of connect logic
}, [enabled]) // Only depend on enabled
```

### Fix 1.3: useSessionStatus.ts

**Problem**: Hook may trigger reconnection on every render due to `enabled` being a new boolean each time.

**Location**: [`lib/hooks/useSessionStatus.ts`](../lib/hooks/useSessionStatus.ts:43-143)

**Fix**: The implementation is actually correct, but we should verify parent components pass stable `enabled` prop.

---

## Part 2: Server-Side Streaming Service (Core Feature)

### Create lib/streaming/chat-service.ts

**New file**: [`lib/streaming/chat-service.ts`](../lib/streaming/chat-service.ts)

```typescript
import { getGatewayManager } from '@/lib/gateway/manager'
import { getDatabase } from '@/lib/db'
import { randomUUID } from 'crypto'

export interface StreamEvent {
  type: 'delta' | 'final' | 'error' | 'agent' | 'lifecycle'
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

class StreamingChatService {
  private sessions: Map<string, StreamingSession> = new Map()
  private eventUnsubscribers: Map<string, () => void> = new Map()
  private readonly BUFFER_SIZE = 1000
  private readonly BUFFER_TTL = 3600000 // 1 hour

  /**
   * Start streaming for a chat session
   */
  async startStreaming(params: {
    sessionId: string
    userId: string
    workspaceId: string
  }): Promise<{ streamId: string; runId?: string }> {
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
      return
    }

    const chatUnsub = client.onEvent('chat', (event: any) => {
      if (event.payload?.sessionKey !== session.sessionKey) return

      const streamEvent: StreamEvent = {
        type: event.payload?.state || 'delta',
        sessionId: session.sessionId,
        runId: event.payload?.runId || session.runId || '',
        data: event.payload,
        timestamp: Date.now()
      }

      this.bufferEvent(session.streamId, streamEvent)

      // Update runId from first event
      if (!session.runId && event.payload?.runId) {
        session.runId = event.payload.runId
      }

      // Update status
      if (event.payload?.state === 'final' || event.payload?.state === 'error') {
        session.status = 'stopped'
      } else {
        session.status = 'streaming'
      }

      session.lastActivityAt = Date.now()
    })

    const agentUnsub = client.onEvent('agent', (event: any) => {
      if (event.payload?.sessionKey !== session.sessionKey) return

      const streamEvent: StreamEvent = {
        type: 'agent',
        sessionId: session.sessionId,
        runId: event.payload?.runId || session.runId || '',
        data: event.payload,
        timestamp: Date.now()
      }

      this.bufferEvent(session.streamId, streamEvent)
    })

    this.eventUnsubscribers.set(session.streamId, () => {
      chatUnsub()
      agentUnsub()
    })
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
    // Stop all active streams
    for (const stream of serviceInstance.getActiveStreams()) {
      serviceInstance.stopStreaming(stream.streamId)
    }
    serviceInstance = null
    console.log('[StreamingChatService] Singleton instance reset')
  }
}
```

### Singleton Pattern Benefits

1. **Single Source of Truth**: All streaming sessions tracked in one place
2. **Shared State**: Multiple API routes access the same streaming sessions
3. **Event Management**: Gateway subscriptions managed centrally
4. **Resource Efficiency**: Proper cleanup and resource management

### Usage Example Across API Routes

```typescript
// In /api/chat/streaming/route.ts
import { getStreamingChatService } from '@/lib/streaming/chat-service'

export async function POST(request: Request) {
  const service = getStreamingChatService() // Gets singleton instance
  const result = await service.startStreaming(params)
  return NextResponse.json(result)
}

// In /api/chat/streaming/[sessionId]/events/route.ts
import { getStreamingChatService } from '@/lib/streaming/chat-service'

export async function GET(request: Request) {
  const service = getStreamingChatService() // Gets SAME instance
  const events = service.getBufferedEvents(sessionId)
  // Returns the same buffered events from the singleton
}
```

### Create app/api/chat/streaming/route.ts

**New file**: [`app/api/chat/streaming/route.ts`](../app/api/chat/streaming/route.ts)

```typescript
import { NextResponse } from 'next/server'
import { getStreamingChatService } from '@/lib/streaming/chat-service'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    const service = getStreamingChatService()
    const result = await service.startStreaming({
      sessionId,
      userId: auth.user.id,
      workspaceId: auth.workspaceId
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Streaming API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start streaming' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    const service = getStreamingChatService()
    const streams = service.getActiveStreams(auth.user.id)

    return NextResponse.json({ streams })
  } catch (error) {
    console.error('[Streaming API] Error:', error)
    return NextResponse.json({ streams: [] })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('streamId')

    if (!streamId) {
      return NextResponse.json({ error: 'Missing streamId' }, { status: 400 })
    }

    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    const service = getStreamingChatService()
    
    // Verify ownership
    const stream = service.getStream(streamId)
    if (!stream || stream.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
    }

    service.stopStreaming(streamId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Streaming API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to stop streaming' },
      { status: 500 }
    )
  }
}
```

### Create app/api/chat/streaming/[sessionId]/events/route.ts

**New file**: [`app/api/chat/streaming/[sessionId]/events/route.ts`](../app/api/chat/streaming/[sessionId]/events/route.ts)

```typescript
import { NextRequest } from 'next/server'
import { getStreamingChatService } from '@/lib/streaming/chat-service'
import { getUserWithWorkspace } from '@/lib/auth/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId

  const auth = await getUserWithWorkspace()
  if (!auth) {
    return new Response('Unauthorized', { status: 401 })
  }

  const service = getStreamingChatService()

  // Check if there's an active stream
  const streamId = service.getStreamId(sessionId)
  
  if (!streamId) {
    return new Response('No active stream', { status: 404 })
  }

  // Verify ownership
  const stream = service.getStream(streamId)
  if (!stream || stream.userId !== auth.user.id) {
    return new Response('Stream not found', { status: 404 })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  
  const streamResponse = new ReadableStream({
    start(controller) {
      // Send buffered events first
      const bufferedEvents = service.getBufferedEvents(streamId)
      for (const event of bufferedEvents) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      // Subscribe to new events
      // In a real implementation, you'd have an event emitter
      // For now, we'll just send the buffered events and close
      
      controller.close()
    }
  })

  return new Response(streamResponse, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
```

---

## Part 3: Messages Gateway API

### Create app/api/chat/gateway/messages/route.ts

**New file**: [`app/api/chat/gateway/messages/route.ts`](../app/api/chat/gateway/messages/route.ts)

```typescript
import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import type { ChatMessage } from '@/lib/db/schema'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    const db = getDatabase()

    // Get session info
    const session = db.prepare(`
      SELECT * FROM chat_sessions 
      WHERE id = ? AND workspace_id = ?
    `).get(sessionId, auth.workspaceId) as any

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get local messages
    const localMessages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(sessionId) as ChatMessage[]

    // Try to get messages from gateway
    let gatewayMessages: any[] = []
    const manager = getGatewayManager()
    const client = manager.getClient(session.gateway_id)

    if (client && client.isConnected()) {
      try {
        const history = await client.getSessionHistory(session.session_key)
        gatewayMessages = history.messages || []
      } catch (error) {
        console.error('[Gateway Messages] Failed to fetch from gateway:', error)
      }
    }

    // Deep merge messages
    const mergedMessages = mergeMessages(localMessages, gatewayMessages, sessionId)

    return NextResponse.json({ messages: mergedMessages })
  } catch (error) {
    console.error('[Gateway Messages] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

function mergeMessages(
  localMessages: ChatMessage[],
  gatewayMessages: any[],
  sessionId: string
): ChatMessage[] {
  const merged = new Map<string, ChatMessage>()

  // Add local messages
  for (const msg of localMessages) {
    merged.set(msg.id, msg);
  }

  // Add gateway messages (create new entries for ones we don't have)
  for (const gmsg of gatewayMessages) {
    // Try to find matching message by content and timestamp
    const key = gmsg.id || `gw-${gmsg.timestamp}-${gmsg.role}`
    
    if (!merged.has(key)) {
      // Parse content if it's a string
      let content = gmsg.content
      if (typeof content === 'string') {
        content = JSON.stringify([{ type: 'text', text: content }])
      }

      merged.set(key, {
        id: key,
        session_id: sessionId,
        role: gmsg.role,
        content: content,
        metadata: gmsg.metadata ? JSON.stringify(gmsg.metadata) : null,
        created_at: gmsg.timestamp || new Date().toISOString()
      })
    }
  }

  // Sort by timestamp
  return Array.from(merged.values())
    .sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
}
```

---

## Part 4: Fix Message Persistence

### Update app/api/chat/sessions/[id]/messages/route.ts

**Location**: [`app/api/chat/sessions/[id]/messages/route.ts`](../app/api/chat/sessions/[id]/messages/route.ts:107-131)

**Problem**: In streaming mode, user message is not saved to database.

**Fix**: Always save user message to database immediately:

```typescript
// STREAMING MODE: Return immediately after queuing the message
if (stream) {
  console.log('[Chat API] Streaming mode: queuing message', { sessionId, runId })

  // *** FIX: Save user message to database immediately ***
  const userMessageId = randomUUID()
  const contentBlocks: ChatContentBlock[] = [{ type: 'text', text: content }]

  db.prepare(`
    INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userMessageId,
    sessionId,
    'user',
    JSON.stringify(contentBlocks),
    null,
    now
  )

  // Send message without waiting for response (deliver=false)
  try {
    await client.sendChatMessage(chatSession.session_key, content, {
      deliver: false,
      idempotencyKey: runId,
    })
  } catch (error) {
    console.error('[Chat API] Error queuing message to agent:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue message' },
      { status: 500 }
    )
  }

  // Return immediately with runId for tracking
  return NextResponse.json({
    runId,
    status: 'queued',
    message: {
      id: userMessageId,
      session_id: sessionId,
      role: 'user',
      content: JSON.stringify(contentBlocks),
      created_at: now
    }
  }, { status: 202 })
}
```

---

## Part 5: Client-Side Integration

### Update lib/hooks/useChat.ts

**Location**: [`lib/query/hooks/useChat.ts`](../lib/query/hooks/useChat.ts)

Add new hook for gateway messages:

```typescript
// Fetch messages from gateway (with merge)
export function useGatewayMessages(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['chat', 'gateway', 'messages', sessionId],
    queryFn: async () => {
      if (!sessionId) return []
      const res = await fetch(`/api/chat/gateway/messages?sessionId=${sessionId}`)
      if (!res.ok) throw new Error('Failed to fetch gateway messages')
      const data = await res.json()
      return data.messages as ChatMessage[]
    },
    enabled: enabled && !!sessionId,
    staleTime: 0, // Always fresh
  })
}

// Combined hook that merges local and gateway messages
export function useChatMessagesWithGateway(sessionId: string | null) {
  const localMessages = useChatMessages(sessionId)
  const gatewayMessages = useGatewayMessages(sessionId, localMessages.isSuccess)

  // Use gateway messages when available, fall back to local
  const messages = gatewayMessages.data || localMessages.data || []
  const isLoading = localMessages.isLoading || gatewayMessages.isLoading

  return { messages, isLoading, refetch: localMessages.refetch }
}
```

---

## Testing Checklist

- [ ] Tab switching: Can switch to sessions tab without it jumping back to chat
- [ ] Streaming continues: Navigate away and back, stream reconnects
- [ ] Messages saved: Send message and navigate away immediately, message is in DB
- [ ] Gateway merge: Messages from gateway appear in chat
- [ ] No duplicates: Merging doesn't create duplicate messages
- [ ] Multiple sessions: Can have multiple active chat sessions
- [ ] Reconnection: Closing and reopening browser reconnects to active stream
