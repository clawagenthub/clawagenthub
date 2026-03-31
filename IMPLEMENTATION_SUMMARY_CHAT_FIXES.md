# Chat Streaming Fixes - Implementation Summary

## Overview

This document summarizes all the changes made to fix the three main chat streaming issues:

1. **useEffect infinite loop** - causing tab to switch back to chat
2. **Chat stops on navigation** - streaming should continue server-side
3. **Messages not saved** - last messages lost when navigating away

## Files Modified

### 1. Fixed useEffect Infinite Loop

#### `components/chat/enhanced-chat-container.tsx`
**Change**: Removed `queryClient` from useEffect dependency array (line 29)
```tsx
// Before:
}, [activeTab, queryClient])

// After:
}, [activeTab])
```
**Impact**: Prevents re-render loop when queries update, allowing sessions tab to stay selected.

#### `lib/hooks/useChatWebSocket.ts`
**Changes**: 
- Removed `useCallback` for `connect`, `disconnect`, `subscribe`, `unsubscribe`, `sendTyping` functions
- Added refs for `sessionId`, `onMessage`, `enabled` to avoid stale closures
- Simplified useEffect dependencies to only `enabled`

**Impact**: Prevents WebSocket reconnection loops when props change.

### 2. Server-Side Streaming Service (New Files)

#### `lib/streaming/chat-service.ts` (NEW)
**Purpose**: Manages active chat sessions on the server side

**Key Features**:
- Singleton pattern - single instance across all API routes
- Buffers streaming events for reconnection (up to 1000 events, 1 hour TTL)
- Subscribes to gateway events (`chat` and `agent`)
- Broadcasts events to WebSocket clients
- Automatic cleanup of old sessions

**API**:
```typescript
getStreamingChatService().startStreaming({ sessionId, userId, workspaceId })
getStreamingChatService().getBufferedEvents(streamId)
getStreamingChatService().isStreaming(sessionId)
getStreamingChatService().stopStreaming(streamId)
getStreamingChatService().getActiveStreams(userId)
```

#### `app/api/chat/streaming/route.ts` (NEW)
**Endpoints**:
- `POST /api/chat/streaming` - Start streaming for a session
- `GET /api/chat/streaming` - Get active streams for current user
- `DELETE /api/chat/streaming?streamId=xxx` - Stop streaming

#### `app/api/chat/streaming/[sessionId]/events/route.ts` (NEW)
**Purpose**: SSE endpoint for reconnection to active streams

**Features**:
- Sends buffered events to reconnecting clients
- Supports reconnection to in-progress streams
- Verifies user ownership of streams

### 3. Messages Gateway API (New File)

#### `app/api/chat/gateway/messages/route.ts` (NEW)
**Purpose**: Pull messages from OpenClaw gateway and merge with local messages

**Features**:
- Fetches messages from gateway using `chat.history`
- Deep merges with local database messages
- Deduplicates by message ID, role, and timestamp
- Falls back to local messages if gateway unavailable

**Endpoint**: `GET /api/chat/gateway/messages?sessionId=xxx`

### 4. Message Persistence Fix

#### `app/api/chat/sessions/[id]/messages/route.ts`
**Critical Change**: User messages are now saved to database IMMEDIATELY in both streaming and legacy modes

```typescript
// *** CRITICAL FIX: Save user message to database IMMEDIATELY ***
const userMessageId = randomUUID()
const contentBlocks: ChatContentBlock[] = [{ type: 'text', text: content }]

db.prepare(`
  INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(userMessageId, sessionId, 'user', JSON.stringify(contentBlocks), null, now)
```

**Impact**: Messages are never lost when navigating away from chat screen.

### 5. New Query Hooks

#### `lib/query/hooks/useChat.ts`
**Added hooks**:
- `useGatewayMessages(sessionId, enabled)` - Fetch messages from gateway
- `useChatMessagesWithGateway(sessionId)` - Combined hook that tries gateway first, falls back to local

#### `lib/query/hooks/index.ts`
**Exported new hooks**: `useGatewayMessages`, `useChatMessagesWithGateway`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Chat UI     │  │ WebSocket    │  │ SSE Reconnection       │ │
│  │             │◄─┤ Client       │◄─┤ (for navigation)       │ │
│  └──────┬──────┘  └──────▲───────┘  └─────────────────────────┘ │
│         │                │                                         │
└─────────┼────────────────┼─────────────────────────────────────────┘
          │                │
          │ HTTP POST      │ WebSocket
          │                │
┌─────────┼────────────────┼─────────────────────────────────────────┐
│         │         ┌──────┴───────────────┐                         │
│  ┌──────▼──────┐ │  API Routes          │  ┌─────────────────────┐ │
│  │ /messages   │ │                      │  │ /streaming/events   │ │
│  │ (saves msg) │ │  /streaming          │  │ (SSE for reconnect) │ │
│  └──────┬──────┘ │                      │  └─────────────────────┘ │
│         │        └──────▲───────────────┘                         │
│  ┌──────▼──────────────┴─────────────────────────────────────────┐ │
│  │              StreamingChatService (Singleton)                  │ │
│  │  - Manages active streams                                      │ │
│  │  - Buffers events (1000 events, 1 hour TTL)                   │ │
│  │  - Subscribes to gateway events                                │ │
│  └──────▲─────────────────────────────────────────────────────────┘ │
│         │                                                             │
│         │ Gateway Events                                             │
│  ┌──────┴─────────────────────────────────────────────────────────┐ │
│  │              Gateway Manager                                     │ │
│  └──────▲─────────────────────────────────────────────────────────┘ │
└─────────┼────────────────────────────────────────────────────────────┘
          │
          │ WebSocket
          │
┌─────────┼────────────────────────────────────────────────────────────┐
│         │         OpenClaw Gateway                                   │
│  ┌──────┴─────────────────────────────────────────────────────────┐ │
│  │              Agent Process (continues running)                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## How It Works Now

### 1. User Sends Message
1. User types message and clicks send
2. **Message saved to database immediately** (critical fix)
3. API returns 202 Accepted with `runId`
4. Streaming starts on server side

### 2. Server-Side Streaming
1. `StreamingChatService` creates a streaming session
2. Service subscribes to gateway `chat` and `agent` events
3. Events are buffered (up to 1000, 1 hour TTL)
4. Events are broadcast to WebSocket clients
5. Stream continues even if client disconnects

### 3. User Navigates Away
1. Client WebSocket connection closes
2. Server continues streaming and buffering events
3. User message is already saved in database

### 4. User Returns to Chat
1. Component mounts, connects to WebSocket
2. Client can reconnect to active stream via:
   - WebSocket (subscribes to session)
   - SSE endpoint `/api/chat/streaming/[sessionId]/events` (pulls buffered events)
3. Alternatively, pull from gateway via `/api/chat/gateway/messages`
4. Messages are merged: local + gateway = complete history

## Testing Checklist

- [ ] Can switch to sessions tab without it jumping back to chat
- [ ] Messages appear immediately when sent (no 2-second delay)
- [ ] Navigate away during streaming - chat continues server-side
- [ ] Navigate back and see complete message history
- [ ] Gateway messages sync with local messages (no duplicates)
- [ ] Multiple chat sessions work independently

## Next Steps

1. **Test thoroughly** - especially navigation during streaming
2. **Monitor performance** - ensure buffering doesn't cause memory issues
3. **Consider enhancements**:
   - Full SSE with keep-alive for long-lived connections
   - Stream resume from specific event ID
   - Client-side retry logic for failed connections

## Related Documentation

- [Streaming Architecture Plan](../plans/server-side-streaming-architecture.md)
- [Implementation Guide](../plans/chat-streaming-fixes-implementation.md)
- [Original Streaming Architecture](../plans/streaming-chat-architecture.md)
