# OpenClaw v3.2 Chat Send Implementation

## ✅ FIXED - Updated to use chat.send

**Date**: 2026-03-08  
**OpenClaw Version**: v3.2 (2026.3.2)

## Summary

ClawAgentHub has been updated to use the correct OpenClaw v3.2 gateway method for sending messages to agents. The old `sessions.send` method does not exist in OpenClaw v3.2. The correct method is `chat.send`.

## The Problem

### Error
```
unknown method: sessions.send
```

### Root Cause
ClawAgentHub was attempting to use `sessions.send` method which does not exist in OpenClaw v3.2. After examining the official OpenClaw repository source code, we confirmed that:

- ❌ `sessions.send` - Does NOT exist
- ✅ `chat.send` - Correct method for sending messages to agents

## The Solution

### 1. Updated Gateway Client ([`lib/gateway/client.ts`](../lib/gateway/client.ts))

Added three new methods:

#### `sendChatMessage()` - Send message (fire and forget)
```typescript
async sendChatMessage(
  sessionKey: string,
  message: string,
  options?: {
    thinking?: string
    deliver?: boolean
    timeoutMs?: number
    idempotencyKey?: string
  }
): Promise<{ runId: string; status: string }>
```

**Usage:**
```typescript
const { runId, status } = await client.sendChatMessage('agent:main:main', 'Hello')
console.log(`Message sent with runId: ${runId}, status: ${status}`)
```

#### `sendChatMessageAndWait()` - Send message and wait for response
```typescript
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
}>
```

**Usage:**
```typescript
const result = await client.sendChatMessageAndWait('agent:main:main', 'Hello')
if (result.error) {
  console.error('Error:', result.error)
} else {
  console.log('Response:', result.message)
}
```

#### `sendAgentMessage()` - Deprecated wrapper
The old method is kept for backward compatibility but logs a deprecation warning.

### 2. Updated API Route ([`app/api/chat/sessions/[id]/messages/route.ts`](../app/api/chat/sessions/[id]/messages/route.ts))

Changed from:
```typescript
await client.sendAgentMessage(chatSession.session_key, content)
```

To:
```typescript
const result = await client.sendChatMessageAndWait(chatSession.session_key, content)
if (result.error) {
  return NextResponse.json({ error: result.error }, { status: 500 })
}
```

## OpenClaw v3.2 chat.send Protocol

### Method
```
chat.send
```

### Required Parameters
```typescript
{
  sessionKey: string;        // Session key (e.g., "agent:main:main")
  message: string;           // Message text
  idempotencyKey: string;    // UUID for deduplication
}
```

### Optional Parameters
```typescript
{
  thinking?: string;         // Prepends /think command
  deliver?: boolean;         // Deliver to external channel
  attachments?: Array<...>;  // File attachments
  timeoutMs?: number;        // Override default timeout
}
```

### Response
```typescript
{
  runId: string;            // Same as idempotencyKey
  status: "started"         // Indicates agent run started
}
```

### Async Response via Events

The actual agent response comes via WebSocket `chat` events:

```typescript
{
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "error";
  delta?: string;           // For streaming
  message?: object;         // For final response
  errorMessage?: string;    // For errors
}
```

## Available Gateway Methods (OpenClaw v3.2)

### Sessions Methods
- `sessions.list` - List all sessions
- `sessions.get` - Get session messages
- `sessions.preview` - Preview session
- `sessions.resolve` - Resolve session key
- `sessions.patch` - Update session metadata
- `sessions.reset` - Reset session history
- `sessions.delete` - Delete session
- `sessions.compact` - Compact transcript

### Chat Methods
- `chat.history` - Get chat history
- **`chat.send`** - ✅ Send message to agent (THIS IS THE CORRECT METHOD)
- `chat.abort` - Abort running chat
- `chat.inject` - Inject assistant message

### Send Methods (External Channels)
- `send` - Send to Telegram, Discord, etc.
- `poll` - Send poll to external channel

## Testing

### Manual Test
1. Start ClawAgentHub: `npm run dev`
2. Connect to OpenClaw gateway
3. Open a chat session
4. Send a message
5. Verify message is sent and response is received

### Expected Behavior
- ✅ Message sends without error
- ✅ Agent processes message
- ✅ Response appears in chat
- ✅ No `unknown method: sessions.send` error

## Migration Notes

### Breaking Changes
1. Method name changed: `sendAgentMessage` → `sendChatMessage` / `sendChatMessageAndWait`
2. Return type changed: Now returns `{ runId, status }` or `{ runId, message?, error? }`
3. Response is async via WebSocket events

### Backward Compatibility
The old `sendAgentMessage` method is kept as a deprecated wrapper that:
- Logs a deprecation warning
- Calls `sendChatMessageAndWait` internally
- Throws error if agent returns error
- Returns the message on success

This allows existing code to continue working while we migrate to the new methods.

## References

- OpenClaw Repository: https://github.com/openclaw/openclaw
- Chat Methods Source: [`src/gateway/server-methods/chat.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/chat.ts)
- Sessions Methods Source: [`src/gateway/server-methods/sessions.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/sessions.ts)
- Fix Plan: [`plans/openclaw-v3.2-chat-send-fix.md`](../plans/openclaw-v3.2-chat-send-fix.md)
- Flow Diagram: [`plans/openclaw-chat-flow-diagram.md`](../plans/openclaw-chat-flow-diagram.md)

## Related Files

- [`lib/gateway/client.ts`](../lib/gateway/client.ts) - Gateway client implementation
- [`app/api/chat/sessions/[id]/messages/route.ts`](../app/api/chat/sessions/[id]/messages/route.ts) - API route
- [`/root/.openclaw/openclaw.json`](/root/.openclaw/openclaw.json) - Local OpenClaw config

## Date Fixed
2026-03-08
