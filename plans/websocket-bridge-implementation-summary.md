# WebSocket Bridge Implementation Summary

## Overview

This implementation creates a WebSocket bridge architecture where server-side session instances maintain persistent connections to the OpenClaw Gateway. This allows chat sessions to continue streaming even when clients close their browsers.

## Architecture

```
Client WebSocket <=> Server Session Instance <=> OpenClaw Gateway
                       (Persistent Connection)
```

## Key Components Created

### 1. `lib/gateway/protocol.ts` (378 lines)
OpenClaw Gateway v3 protocol types including:
- Request/Response/Event frame types
- Chat protocol (send, history, abort)
- Agent protocol (typing indicators)
- Instance bridge protocol (client-to-instance communication)
- Session state types

### 2. `lib/gateway/buffer.ts` (158 lines)
Circular event buffer for reconnection scenarios:
- Stores up to 1000 events with 5-minute TTL
- Supports sequence-based resume for reconnections
- Provides buffer statistics and cleanup

### 3. `lib/gateway/config.ts` (124 lines)
Gateway configuration from SQLite database:
- Reads gateway settings from `gateways` table
- Provides `getDefaultGateway()` for automatic routing
- Includes workspace-specific gateway queries
- Agent session key utilities (`agent:{agentId}:main`)

### 4. `lib/gateway/session-instance.ts` (650+ lines)
Persistent server-side WebSocket connection to OpenClaw:
- Maintains persistent gateway connection
- Buffers events for client reconnection
- Supports multiple connected clients per instance
- Handles chat.send, chat.abort, and agent events
- Auto-reconnects to gateway on disconnect
- Idle timeout after 30 minutes of no clients/activity

### 5. `lib/gateway/instance-manager.ts` (350+ lines)
Singleton manager for session instances:
- Creates and reuses instances per session
- Maps clients to sessions
- Cleans up idle instances
- Provides statistics on active instances

### 6. `app/api/chat/ws/route.ts` (Updated)
WebSocket route with instance bridge support:
- New `instance.subscribe` message to connect to gateway instance
- New `instance.unsubscribe` message to disconnect
- Forwards `chat.send` and `chat.abort` to instances
- Sends capability flag to clients

### 7. `lib/hooks/useChatWebSocket.ts` (Updated)
Client-side hook with instance bridge support:
- New `useInstanceBridge` option
- New `instanceState` and `currentSeq` state tracking
- New `sendChatMessage()` and `abortChat()` methods
- Automatic sequence resume on reconnection

### 8. `components/chat/enhanced-chat-screen.tsx` (Updated)
Chat screen now uses instance bridge:
- Enabled `useInstanceBridge: true`
- Added `agentId` parameter
- Can send messages directly through WebSocket instance

## Data Flow

### Client Connects to Instance
1. Client sends `instance.subscribe` with sessionId and agentId
2. Instance manager creates/reuses session instance
3. Instance connects to OpenClaw Gateway (if not connected)
4. Client receives `connected` event with current sequence number
5. Buffered events since `sinceSeq` are sent to client

### Client Sends Message
1. Client sends `chat.send` message
2. WebSocket route forwards to instance manager
3. Instance manager forwards to session instance
4. Session instance calls `chat.send` on OpenClaw Gateway
5. Gateway streams back chat events
6. Session instance broadcasts to all connected clients

### Client Disconnects
1. Client connection closes
2. Instance removes client but keeps gateway connection
3. Other clients continue receiving events
4. Events are buffered for reconnection

### Client Reconnects
1. Client sends `instance.subscribe` with last `currentSeq`
2. Instance sends all events since that sequence
3. Client resumes from where it left off

## Configuration

Settings are read from the SQLite `gateways` table:
- `id` - Gateway identifier
- `name` - Display name
- `url` - WebSocket URL (e.g., `ws://127.0.0.1:18789`)
- `auth_token` - Authentication token
- `status` - Connection status

## Event Types

### Client to Instance
- `instance.subscribe` - Connect to gateway instance
- `instance.unsubscribe` - Disconnect from instance
- `chat.send` - Send chat message
- `chat.abort` - Abort running chat
- `ping` - Keep-alive

### Instance to Client
- `connected` - Connection confirmed with currentSeq
- `chat.delta` - Streaming content chunk
- `chat.final` - Final message
- `chat.error` - Error occurred
- `agent.typing` - Agent typing indicator
- `state.changed` - Instance state changed
- `error` - General error
- `pong` - Ping response

## Sequence Numbers

Each event from the gateway has a sequence number that:
- Increments for each gateway event
- Is stored in the event buffer
- Allows clients to resume after disconnection
- Enables catching up on missed events

## Idle Timeout

Session instances automatically stop after:
- 30 minutes with no connected clients, OR
- 30 minutes of no activity (no messages/commands)

This prevents resource leaks from abandoned sessions.

## Testing Checklist

- [ ] Test basic message sending through instance
- [ ] Test streaming messages continue when browser closes
- [ ] Test reconnection receives missed events
- [ ] Test multiple clients can connect to same session
- [ ] Test idle timeout cleans up instances
- [ ] Test error handling when gateway unavailable
- [ ] Verify sequence numbers increment correctly
- [ ] Test agent typing indicators
- [ ] Verify database-based gateway configuration

## Next Steps

1. Add visual connection state indicators to the UI
2. Add an admin panel to view active instances
3. Add metrics for monitoring instance health
4. Consider adding per-instance rate limiting
5. Add support for multiple agents per session
