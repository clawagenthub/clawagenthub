# Server-Side Streaming Chat Architecture

## Problem Statement

The current chat implementation has several critical issues:

1. **useEffect Infinite Loop**: When writing to chat screen then clicking sessions tab, it returns to chat streaming tab again
2. **Streaming Stops on Navigation**: When chatting and navigating to other pages, the chat stream stops because streaming is client-side only
3. **Last Messages Not Saved**: When entering a prompt and navigating away, the last messages are not persisted

## Root Cause Analysis

### Issue 1: useEffect Infinite Loop

The issue is in `enhanced-chat-container.tsx`:

```tsx
useEffect(() => {
  if (activeTab === 'sessions' && previousTabRef.current !== 'sessions') {
    console.log('[EnhancedChatContainer] Switching to sessions tab - refetching sessions')
    queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
  }
  previousTabRef.current = activeTab
}, [activeTab, queryClient])
```

The `queryClient` dependency causes re-renders when queries update, which triggers the effect again.

### Issue 2: Streaming Stops on Navigation

Current flow:
- Client connects to WebSocket for streaming
- When user navigates away, component unmounts
- WebSocket connection is closed
- Gateway continues processing but client has no way to reconnect

The streaming state is client-side only in `useStreamingChat` hook. When the component unmounts, the streaming state is lost.

### Issue 3: Messages Not Saved

In streaming mode, the API returns 202 Accepted immediately without saving the user message to the database. The message is only saved when:
1. The gateway responds (in legacy mode)
2. Or the stream completes (via WebSocket event)

If the user navigates away before the stream completes, the message is lost.

## Proposed Architecture

### Server-Side Streaming Service

Create a service that manages active chat sessions on the server side:

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        UI["Chat UI"]
        WS["WebSocket Client"]
        SSE["SSE Connection"]
    end
    
    subgraph Server["ClawAgentHub Server"]
        API["Chat API"]
        StreamSvc["Streaming Service"]
        SessionMgr["Session Manager"]
        WS_Server["WebSocket Server"]
    end
    
    subgraph OpenClaw["OpenClaw Gateway"]
        Gateway["Gateway WebSocket"]
        Agent["Agent Process"]
    end
    
    UI -->|1. Send message| API
    API -->|2. Start stream| StreamSvc
    StreamSvc -->|3. Create session| SessionMgr
    StreamSvc -->|4. Forward request| Gateway
    Gateway -->|5. Start processing| Agent
    
    Agent -->|6. Streaming events| Gateway
    Gateway -->|7. Events| StreamSvc
    StreamSvc -->|8. Buffer events| SessionMgr
    StreamSvc -->|9. Broadcast| WS_Server
    
    WS_Server -->|10. Push via WebSocket| WS
    
    UI -.->|11. Reconnect after navigation| SSE
    SSE -.->|12. Get buffered events| SessionMgr
    
    style StreamSvc fill:#e1f5fe
    style SessionMgr fill:#fff3e0
```

### Key Components

#### 1. StreamingChatService (`lib/streaming/chat-service.ts`)

```typescript
class StreamingChatService {
  // Active streaming sessions
  private sessions: Map<string, StreamingSession>
  
  // Start streaming for a session
  startStreaming(sessionId: string, sessionKey: string): Promise<string>
  
  // Get buffered events for a session (for reconnection)
  getBufferedEvents(sessionId: string): StreamEvent[]
  
  // Check if session is actively streaming
  isStreaming(sessionId: string): boolean
  
  // Stop streaming for a session
  stopStreaming(sessionId: string): void
  
  // Get status of all active streams
  getActiveStreams(): StreamStatus[]
}

interface StreamingSession {
  sessionId: string
  sessionKey: string
  runId: string
  status: 'starting' | 'streaming' | 'error' | 'stopped'
  startedAt: number
  lastActivityAt: number
  bufferedEvents: StreamEvent[]
  clientCount: number
}
```

#### 2. API Routes

##### POST /api/chat/streaming
Start streaming for a session (returns stream ID)

##### GET /api/chat/streaming
Get status of all active streaming sessions

##### DELETE /api/chat/streaming/:sessionId
Stop streaming for a session

##### GET /api/chat/streaming/:sessionId/events
SSE endpoint for receiving streaming events (supports reconnection)

##### GET /api/chat/gateway/messages?sessionId=xxx
Pull messages from gateway (chat.history) and deep merge with local messages

### Data Flow

#### Starting a Stream

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Chat UI
    participant API as Chat API
    participant Stream as Streaming Service
    participant Gateway as OpenClaw Gateway
    
    U->>UI: Send message
    UI->>API: POST /messages (stream=true)
    API->>Stream: startStreaming(sessionId)
    Stream->>Gateway: chat.send
    Gateway-->>Stream: runId
    Stream-->>API: { runId, streamId }
    API-->>UI: 202 Accepted
    
    Note over Stream,Gateway: Agent processing...
    
    Gateway->>Stream: chat.delta events
    Stream->>Stream: Buffer events
    
    Gateway->>Stream: chat.final event
    Stream->>Stream: Save to DB, clear buffer
```

#### Reconnecting After Navigation

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Chat UI
    participant API as Chat API
    participant Stream as Streaming Service
    participant DB as Database
    
    U->>UI: Navigate to chat screen
    UI->>API: GET /streaming/:sessionId/events
    
    alt Stream is active
        API->>Stream: getBufferedEvents()
        Stream-->>API: Buffered events
        API-->>UI: SSE: buffered events
        Stream->>UI: SSE: live events
    else Stream completed
        API->>DB: getMessages()
        DB-->>API: All messages
        API-->>UI: Final state
    end
```

### Implementation Plan

#### Phase 1: Fix useEffect Loops (Immediate)

**File: `components/chat/enhanced-chat-container.tsx`**
- Remove `queryClient` from dependency array
- Use `useRef` for queryClient or use `useCallback` for invalidation

**File: `lib/hooks/useChatWebSocket.ts`**
- Fix the dependency issue in `useEffect` that causes reconnection
- Memoize the `connect` callback properly

**File: `lib/hooks/useSessionStatus.ts`**
- The hook is already properly implemented, but we should verify no loops

#### Phase 2: Server-Side Streaming Service

**New file: `lib/streaming/chat-service.ts`**
- Create `StreamingChatService` class
- Implement session management
- Implement event buffering
- Integrate with existing GatewayManager

**New file: `app/api/chat/streaming/route.ts`**
- POST: Start streaming
- GET: List active streams
- DELETE: Stop streaming

**New file: `app/api/chat/streaming/[sessionId]/events/route.ts`**
- SSE endpoint for streaming events
- Supports reconnection with `Last-Event-ID` header

#### Phase 3: Messages Gateway API

**New file: `app/api/chat/gateway/messages/route.ts`**
- GET: Pull messages from gateway
- Deep merge with local messages
- Deduplication logic

**Update: `lib/query/hooks/useChat.ts`**
- Add `useGatewayMessages` hook
- Add `useChatMessagesWithGateway` hook (merges both sources)

#### Phase 4: Client-Side Integration

**Update: `lib/hooks/useStreamingChat.ts`**
- Add reconnection logic
- Handle SSE fallback if WebSocket is closed

**Update: `components/chat/enhanced-chat-screen.tsx`**
- Save messages to DB immediately on send (optimistic)
- Handle reconnection to active streams

### Message Persistence Strategy

```mermaid
flowchart LR
    A[User sends message] --> B{Save to DB immediately}
    B --> C[Message in DB]
    C --> D[Send to gateway]
    D --> E[Gateway processes]
    E --> F[Stream response]
    F --> G[Update DB with response]
    
    style C fill:#90EE90
    style G fill:#90EE90
```

All user messages should be saved to the database **immediately** when sent, not after the stream completes. This ensures messages are never lost.

### Deep Merge Strategy

When pulling messages from gateway:

```typescript
function mergeMessages(
  localMessages: ChatMessage[],
  gatewayMessages: SessionMessage[]
): ChatMessage[] {
  const merged = new Map<string, ChatMessage>()
  
  // Add local messages first
  for (const msg of localMessages) {
    merged.set(msg.id, msg)
  }
  
  // Add gateway messages
  for (const gmsg of gatewayMessages) {
    const key = gmsg.id || `${gmsg.timestamp}-${gmsg.role}`
    if (!merged.has(key)) {
      merged.set(key, {
        id: key,
        session_id: sessionId,
        role: gmsg.role,
        content: JSON.stringify([{ type: 'text', text: gmsg.content }]),
        created_at: gmsg.timestamp || new Date().toISOString()
      })
    }
  }
  
  // Sort by timestamp
  return Array.from(merged.values())
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}
```

## Configuration

Add to application settings:

```typescript
interface StreamingConfig {
  enabled: boolean
  bufferSize: number        // Max events to buffer per session (default: 1000)
  bufferTTL: number         // How long to keep buffered events (default: 3600000ms)
  reconnectionTimeout: number // How long to wait for reconnection (default: 300000ms)
  saveImmediately: boolean  // Save user messages to DB immediately (default: true)
}
```

## Migration Strategy

1. **Feature flag** the server-side streaming
2. **Dual mode operation**: Keep client-side streaming as fallback
3. **Gradual rollout**:
   - Phase 1: Fix useEffect loops
   - Phase 2: Implement server-side streaming service
   - Phase 3: Add messages gateway API
   - Phase 4: Full integration with optimistic updates
4. **Monitoring**: Add metrics for streaming reconnections

## Success Metrics

- **Navigation resilience**: Chat continues streaming after page navigation
- **Message persistence**: No messages lost when navigating away
- **Reconnection time**: <1 second to reconnect to active stream
- **Message merge**: No duplicate messages when pulling from gateway
