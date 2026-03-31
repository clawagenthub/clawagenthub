# OpenClaw v3.2 Fix - Implementation Summary

## Changes Made

### 1. Gateway Client ([`lib/gateway/client.ts`](../lib/gateway/client.ts))

**Added three new methods:**

#### `sendChatMessage()`
- Uses correct `chat.send` method (not `sessions.send`)
- Generates `idempotencyKey` automatically
- Returns `{ runId, status }`
- Fire-and-forget pattern

#### `sendChatMessageAndWait()`
- Sends message using `chat.send`
- Waits for agent response via WebSocket events
- Returns `{ runId, message?, error? }`
- Handles timeout (default 120s)
- Recommended for API routes

#### `sendAgentMessage()` (deprecated)
- Kept for backward compatibility
- Logs deprecation warning
- Wraps `sendChatMessageAndWait()`

**Key Changes:**
- ✅ Changed from `sessions.send` to `chat.send`
- ✅ Added required `idempotencyKey` parameter
- ✅ Removed unsupported `metadata` parameter
- ✅ Implemented async response handling via events
- ✅ Added proper error handling

### 2. API Route ([`app/api/chat/sessions/[id]/messages/route.ts`](../app/api/chat/sessions/[id]/messages/route.ts))

**Updated POST handler:**

Before:
```typescript
await client.sendAgentMessage(chatSession.session_key, content)
```

After:
```typescript
const result = await client.sendChatMessageAndWait(chatSession.session_key, content)
if (result.error) {
  return NextResponse.json({ error: result.error }, { status: 500 })
}
```

**Key Changes:**
- ✅ Uses new `sendChatMessageAndWait()` method
- ✅ Handles agent errors properly
- ✅ Returns `runId` and `agentResponse` in response
- ✅ Better error messages

### 3. Documentation

**Created:**
- [`docs/OPENCLAW_V3.2_CHAT_SEND.md`](../docs/OPENCLAW_V3.2_CHAT_SEND.md) - Complete implementation guide
- [`plans/openclaw-v3.2-chat-send-fix.md`](../plans/openclaw-v3.2-chat-send-fix.md) - Detailed fix plan
- [`plans/openclaw-chat-flow-diagram.md`](../plans/openclaw-chat-flow-diagram.md) - Visual diagrams

## What Was Wrong

### The Error
```
unknown method: sessions.send
```

### Root Cause
ClawAgentHub was using `sessions.send` which **does not exist** in OpenClaw v3.2.

After examining the official OpenClaw repository:
- ❌ `sessions.send` - Does NOT exist
- ✅ `chat.send` - Correct method

### Why It Happened
The documentation and reference implementations were outdated. The actual OpenClaw v3.2 source code shows that:
- Sessions methods only handle: list, get, preview, resolve, patch, reset, delete, compact
- Chat methods handle messaging: history, send, abort, inject

## How It's Fixed

### Correct Method: `chat.send`

**Parameters:**
```typescript
{
  sessionKey: string,        // Required
  message: string,           // Required
  idempotencyKey: string,    // Required (UUID)
  thinking?: string,         // Optional
  deliver?: boolean,         // Optional
  timeoutMs?: number         // Optional
}
```

**Response:**
```typescript
{
  runId: string,            // Same as idempotencyKey
  status: "started"         // Agent run started
}
```

**Async Response:**
The actual agent response comes via WebSocket `chat` events:
```typescript
{
  runId: string,
  sessionKey: string,
  seq: number,
  state: "delta" | "final" | "error",
  delta?: string,           // Streaming text
  message?: object,         // Final response
  errorMessage?: string     // Error message
}
```

## Testing

### To Test Manually:
1. Start ClawAgentHub: `npm run dev`
2. Connect to OpenClaw gateway (localhost:18789)
3. Open a chat session
4. Send a message
5. Verify response appears

### Expected Results:
- ✅ No `unknown method: sessions.send` error
- ✅ Message sends successfully
- ✅ Agent processes message
- ✅ Response appears in chat UI

## Files Modified

1. **[`lib/gateway/client.ts`](../lib/gateway/client.ts)**
   - Added `sendChatMessage()` method
   - Added `sendChatMessageAndWait()` method
   - Deprecated `sendAgentMessage()` with backward-compatible wrapper

2. **[`app/api/chat/sessions/[id]/messages/route.ts`](../app/api/chat/sessions/[id]/messages/route.ts)**
   - Updated to use `sendChatMessageAndWait()`
   - Added error handling for agent errors
   - Returns `runId` and `agentResponse`

## Files Created

1. **[`docs/OPENCLAW_V3.2_CHAT_SEND.md`](../docs/OPENCLAW_V3.2_CHAT_SEND.md)**
   - Complete implementation guide
   - Usage examples
   - Protocol documentation

2. **[`plans/openclaw-v3.2-chat-send-fix.md`](../plans/openclaw-v3.2-chat-send-fix.md)**
   - Detailed fix plan
   - Root cause analysis
   - Migration notes

3. **[`plans/openclaw-chat-flow-diagram.md`](../plans/openclaw-chat-flow-diagram.md)**
   - Visual flow diagrams
   - Method comparison
   - Architecture diagrams

## Backward Compatibility

The old `sendAgentMessage()` method is kept as a deprecated wrapper:
- Logs deprecation warning
- Calls `sendChatMessageAndWait()` internally
- Maintains same behavior for existing code
- Allows gradual migration

## Next Steps

1. **Test with actual OpenClaw gateway** - Verify the fix works
2. **Update UI components** - Consider showing streaming responses
3. **Monitor logs** - Check for deprecation warnings
4. **Migrate callers** - Update code to use new methods

## References

- OpenClaw Repository: https://github.com/openclaw/openclaw
- Chat Methods: [`src/gateway/server-methods/chat.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/chat.ts)
- Sessions Methods: [`src/gateway/server-methods/sessions.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/sessions.ts)

## Date
2026-03-08
