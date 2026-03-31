# OpenClaw v3.2 Chat Send Fix Plan

## Problem Summary

ClawAgentHub is attempting to use `sessions.send` method to send messages to OpenClaw agents, but this method **does not exist** in OpenClaw v3.2 (2026.3.2). This causes the error:

```
unknown method: sessions.send
```

## Root Cause Analysis

After examining the official OpenClaw v3.2 source code at [`openclaw/openclaw`](https://github.com/openclaw/openclaw), I found:

### Available Gateway Methods

**Sessions Methods** ([`src/gateway/server-methods/sessions.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/sessions.ts)):
- `sessions.list` - List all sessions
- `sessions.preview` - Preview session messages
- `sessions.resolve` - Resolve session key
- `sessions.patch` - Update session metadata
- `sessions.reset` - Reset session history
- `sessions.delete` - Delete a session
- `sessions.get` - Get session messages
- `sessions.compact` - Compact session transcript

**❌ NO `sessions.send` method exists**

**Chat Methods** ([`src/gateway/server-methods/chat.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/chat.ts)):
- `chat.history` - Get chat history
- `chat.abort` - Abort running chat
- **✅ `chat.send` - Send message to agent (THIS IS THE CORRECT METHOD)**
- `chat.inject` - Inject assistant message into transcript

**Send Methods** ([`src/gateway/server-methods/send.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/send.ts)):
- `send` - Send message to external channel (Telegram, Discord, etc.)
- `poll` - Send poll to external channel

## Correct Method: `chat.send`

### Method Signature

```typescript
"chat.send": async ({ params, respond, context, client }) => {
  // Validates and processes chat.send request
}
```

### Required Parameters

```typescript
{
  sessionKey: string;        // Session key to send message to
  message: string;           // Message text to send
  idempotencyKey: string;    // Required for deduplication
  
  // Optional parameters:
  thinking?: string;         // Optional thinking text (prepends /think command)
  deliver?: boolean;         // Whether to deliver to external channel
  attachments?: Array<{      // Optional attachments
    type?: string;
    mimeType?: string;
    fileName?: string;
    content?: unknown;
  }>;
  timeoutMs?: number;        // Override default agent timeout
}
```

### Response Format

**Success (Acknowledged):**
```typescript
{
  runId: string;           // The idempotencyKey
  status: "started"        // Indicates agent run has started
}
```

**Success (Cached):**
```typescript
{
  runId: string;
  status: "in_flight" | "ok" | "error"
}
```

**Error:**
```typescript
{
  code: string;
  message: string;
}
```

### Important Behavior

1. **Asynchronous Response**: `chat.send` returns immediately with `status: "started"` and the actual agent response is delivered via WebSocket events on the `chat` event type.

2. **Event Stream**: After sending, the gateway broadcasts `chat` events with:
   ```typescript
   {
     runId: string;
     sessionKey: string;
     seq: number;
     state: "delta" | "final" | "error";
     delta?: string;           // For streaming deltas
     message?: object;         // For final message
     errorMessage?: string;    // For errors
   }
   ```

3. **Idempotency**: The `idempotencyKey` is used for deduplication. If the same key is sent again, it returns cached result.

4. **Stop Command**: If message is `/stop`, it aborts running chat instead of sending.

## Current ClawAgentHub Implementation

### Current Code ([`lib/gateway/client.ts:433-456`](githubprojects/clawhub/lib/gateway/client.ts))

```typescript
async sendAgentMessage(
  sessionKey: string,
  message: string,
  metadata?: {
    label?: string
    id?: string
  }
): Promise<unknown> {
  console.log('[GatewayClient] Sending message to agent', {
    sessionKey,
    messageLength: message.length,
    hasMetadata: !!metadata
  })

  // Gateway expects simple string message, not complex object
  return await this.call('sessions.send', {  // ❌ WRONG METHOD
    sessionKey,
    message,
    metadata: metadata || {
      label: 'openclaw-control-ui',
      id: 'clawhub-dashboard'
    }
  })
}
```

### Issues

1. ❌ Uses non-existent `sessions.send` method
2. ❌ Sends `metadata` parameter (not supported by `chat.send`)
3. ❌ Missing required `idempotencyKey` parameter
4. ❌ Doesn't handle async response pattern
5. ❌ Doesn't listen for `chat` events for actual response

## Fix Implementation Plan

### 1. Update Gateway Client Method

**File**: [`lib/gateway/client.ts`](githubprojects/clawhub/lib/gateway/client.ts)

**Changes**:
- Rename method to `sendChatMessage` (more accurate)
- Use `chat.send` instead of `sessions.send`
- Add `idempotencyKey` parameter (generate UUID)
- Remove `metadata` parameter
- Add optional `timeoutMs` parameter
- Return the `runId` for tracking

```typescript
async sendChatMessage(
  sessionKey: string,
  message: string,
  options?: {
    thinking?: string
    deliver?: boolean
    timeoutMs?: number
  }
): Promise<{ runId: string; status: string }> {
  const idempotencyKey = randomUUID() // or pass from caller
  
  console.log('[GatewayClient] Sending chat message', {
    sessionKey,
    messageLength: message.length,
    idempotencyKey
  })

  const result = await this.call('chat.send', {
    sessionKey,
    message,
    idempotencyKey,
    ...options
  })

  return result as { runId: string; status: string }
}
```

### 2. Add Chat Event Listener

**File**: [`lib/gateway/client.ts`](githubprojects/clawhub/lib/gateway/client.ts)

**Changes**:
- Add method to listen for `chat` events
- Filter by `runId` to get specific response
- Handle `delta`, `final`, and `error` states

```typescript
async sendChatMessageAndWait(
  sessionKey: string,
  message: string,
  options?: {
    thinking?: string
    deliver?: boolean
    timeoutMs?: number
  }
): Promise<{
  runId: string
  message?: unknown
  error?: string
}> {
  const { runId } = await this.sendChatMessage(sessionKey, message, options)
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Chat response timeout'))
    }, options?.timeoutMs || 120000)
    
    const cleanup = this.onEvent('chat', (event) => {
      if (event.runId !== runId) return
      
      if (event.state === 'final') {
        clearTimeout(timeout)
        cleanup()
        resolve({
          runId,
          message: event.message
        })
      } else if (event.state === 'error') {
        clearTimeout(timeout)
        cleanup()
        resolve({
          runId,
          error: event.errorMessage
        })
      }
      // Ignore 'delta' events for now
    })
  })
}
```

### 3. Update API Route

**File**: [`app/api/chat/sessions/[id]/messages/route.ts`](githubprojects/clawhub/app/api/chat/sessions/[id]/messages/route.ts)

**Changes**:
- Use new `sendChatMessageAndWait` method
- Handle async response properly
- Return appropriate status codes

```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionKey = params.id
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const gateway = getGatewayClient()
    if (!gateway) {
      return NextResponse.json(
        { error: 'Gateway not connected' },
        { status: 503 }
      )
    }

    // Send message and wait for response
    const result = await gateway.sendChatMessageAndWait(sessionKey, message)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      runId: result.runId,
      message: result.message
    })
  } catch (error) {
    console.error('[API] Send message error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    )
  }
}
```

### 4. Update Documentation

**File**: [`docs/GATEWAY_MESSAGING_FIX.md`](githubprojects/clawhub/docs/GATEWAY_MESSAGING_FIX.md)

**Changes**:
- Update to reflect correct `chat.send` method
- Document the async response pattern
- Add examples of event handling
- Remove references to `sessions.send`

## Testing Plan

### 1. Unit Tests

Test the gateway client methods:
- ✅ `sendChatMessage` generates valid `idempotencyKey`
- ✅ `sendChatMessage` calls `chat.send` with correct parameters
- ✅ `sendChatMessageAndWait` waits for `chat` event
- ✅ `sendChatMessageAndWait` handles timeout
- ✅ `sendChatMessageAndWait` handles error events

### 2. Integration Tests

Test with actual OpenClaw gateway:
- ✅ Connect to local OpenClaw gateway
- ✅ Send message to main session
- ✅ Verify message appears in session history
- ✅ Verify agent responds
- ✅ Test with different session keys
- ✅ Test error handling (invalid session, etc.)

### 3. Manual Testing

Test through ClawAgentHub UI:
- ✅ Open chat interface
- ✅ Send message to agent
- ✅ Verify message appears in chat
- ✅ Verify agent response appears
- ✅ Test multiple messages in sequence
- ✅ Test with different agents

## Migration Notes

### Breaking Changes

1. **Method Name Change**: `sendAgentMessage` → `sendChatMessage`
   - Update all callers to use new method name

2. **Return Type Change**: Now returns `{ runId, status }` instead of raw response
   - Update code that depends on return value

3. **Async Response Pattern**: Response now comes via events, not return value
   - Use `sendChatMessageAndWait` if you need to wait for response
   - Or listen to `chat` events manually

### Backward Compatibility

To maintain backward compatibility during migration:

```typescript
// Keep old method as deprecated wrapper
/** @deprecated Use sendChatMessage instead */
async sendAgentMessage(
  sessionKey: string,
  message: string,
  metadata?: { label?: string; id?: string }
): Promise<unknown> {
  console.warn('[GatewayClient] sendAgentMessage is deprecated, use sendChatMessage')
  const result = await this.sendChatMessageAndWait(sessionKey, message)
  return result.message
}
```

## Implementation Order

1. ✅ **Research** - Examine OpenClaw v3.2 source code (COMPLETED)
2. ✅ **Plan** - Create this fix plan document (COMPLETED)
3. ⏳ **Implement** - Update gateway client with new methods
4. ⏳ **Update** - Update API route to use new methods
5. ⏳ **Test** - Test with actual OpenClaw gateway
6. ⏳ **Document** - Update documentation
7. ⏳ **Deploy** - Deploy to production

## References

- OpenClaw Repository: https://github.com/openclaw/openclaw
- Chat Methods Source: [`src/gateway/server-methods/chat.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/chat.ts)
- Sessions Methods Source: [`src/gateway/server-methods/sessions.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/sessions.ts)
- Gateway Protocol: OpenClaw Gateway Protocol v3
- Local OpenClaw Config: [`/root/.openclaw/openclaw.json`](/root/.openclaw/openclaw.json)

## Additional Considerations

### 1. Streaming Responses

The `chat.send` method supports streaming responses via `delta` events. ClawAgentHub could implement real-time streaming:

```typescript
this.onEvent('chat', (event) => {
  if (event.runId !== runId) return
  
  if (event.state === 'delta') {
    // Update UI with streaming text
    onDelta?.(event.delta)
  }
})
```

### 2. Multiple Concurrent Requests

The `idempotencyKey` ensures that duplicate requests are handled correctly. ClawAgentHub should:
- Generate unique keys per request
- Store mapping of `runId` to UI elements
- Handle multiple concurrent chats

### 3. Error Handling

Implement robust error handling for:
- Gateway disconnection during chat
- Agent timeout
- Invalid session keys
- Rate limiting

### 4. Session History

After sending a message, ClawAgentHub can use `chat.history` to retrieve the full conversation:

```typescript
const history = await gateway.call('chat.history', {
  sessionKey,
  limit: 50
})
```

## Conclusion

The fix requires changing from the non-existent `sessions.send` method to the correct `chat.send` method, along with updating the parameter format and handling the async response pattern. This is a straightforward change that aligns ClawAgentHub with the actual OpenClaw v3.2 API.
