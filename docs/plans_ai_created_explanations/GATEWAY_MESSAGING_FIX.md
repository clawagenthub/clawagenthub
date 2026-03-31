# Gateway Messaging Fix - sessions.send Protocol

## Issue Summary

**Error**: `unknown method: sessions.send`

**Root Cause**: The ClawdBot gateway protocol expects a simple string message, but our implementation was sending a complex object with `role` and `content` arrays.

## The Problem

### What We Were Sending (WRONG)
```typescript
await client.sendAgentMessage(sessionKey, {
  role: 'user',
  content: [
    { type: 'text', text: 'Hello' }
  ]
})
```

Gateway received:
```json
{
  "type": "req",
  "id": "...",
  "method": "sessions.send",
  "params": {
    "sessionKey": "agent:coder:main",
    "message": {
      "role": "user",
      "content": [{"type": "text", "text": "Hello"}]
    }
  }
}
```

### What Gateway Expects (CORRECT)
```typescript
await client.sendAgentMessage(sessionKey, 'Hello')
```

Gateway expects:
```json
{
  "type": "req",
  "id": "...",
  "method": "sessions.send",
  "params": {
    "sessionKey": "agent:coder:main",
    "message": "Hello"
  }
}
```

## The Fix

### 1. Updated Gateway Client Method

**File**: `lib/gateway/client.ts`

Changed the `sendAgentMessage` method signature from:
```typescript
async sendAgentMessage(
  sessionKey: string,
  message: {
    role: 'user' | 'assistant'
    content: Array<{...}>
  },
  metadata?: {...}
): Promise<unknown>
```

To:
```typescript
async sendAgentMessage(
  sessionKey: string,
  message: string,  // ✅ Simple string
  metadata?: {...}
): Promise<unknown>
```

### 2. Updated API Route

**File**: `app/api/chat/sessions/[id]/messages/route.ts`

Changed from:
```typescript
await client.sendAgentMessage(
  chatSession.session_key,
  {
    role: 'user',
    content: contentBlocks
  }
)
```

To:
```typescript
await client.sendAgentMessage(
  chatSession.session_key,
  content  // ✅ Raw text string
)
```

## Why This Works

The ClawdBot gateway protocol is designed for simplicity at the client level:

1. **Client sends**: Simple text string
2. **Gateway handles**: Message formatting, role assignment, content structuring
3. **Agent receives**: Properly formatted message with all metadata

This design:
- Reduces client complexity
- Ensures consistent message formatting
- Allows gateway to add system-level metadata
- Simplifies protocol versioning

## Reference Implementation

Based on the working implementation from [`kevinelliott/openclaw-team-control`](https://github.com/kevinelliott/openclaw-team-control):

```javascript
// From server/index.js line 241
await gatewayManager.sendRequest(gatewayId, 'sessions.send', {
  sessionKey: agent.sessionKey,
  message: '/restart'  // ✅ Simple string
})

// From server/index.js line 289
await gatewayManager.sendRequest(gatewayId, 'sessions.send', {
  sessionKey: agent.sessionKey,
  message  // ✅ String variable
})
```

## Protocol Methods Summary

### Working Methods
- ✅ `connect` - Authenticate with gateway
- ✅ `status` - Get gateway status
- ✅ `health` - Health check
- ✅ `agents.list` - List available agents
- ✅ `sessions.list` - List active sessions
- ✅ `sessions.history` - Get session message history
- ✅ `sessions.delete` - Close a session
- ✅ `sessions.send` - Send message (requires string)

### Message Format
```typescript
// ✅ CORRECT
{ sessionKey: string, message: string }

// ❌ WRONG
{ sessionKey: string, message: { role: string, content: Array } }
```

## Testing

To verify the fix works:

1. Start your ClawAgentHub server
2. Connect to a gateway with a valid token
3. Create a chat session with an agent
4. Send a message through the UI
5. Check logs for successful message delivery

Expected log output:
```
[GatewayClient] Sending message to agent { sessionKey: 'agent:coder:main', messageLength: 5, hasMetadata: false }
[GatewayClient] RPC call { method: 'sessions.send', hasParams: true }
POST /api/chat/sessions/xxx/messages 200 in 15ms
```

## Related Files

- `lib/gateway/client.ts` - Gateway WebSocket client
- `app/api/chat/sessions/[id]/messages/route.ts` - Chat message API
- `lib/db/schema.ts` - Database schema for chat messages

## Date Fixed

2026-03-08

## References

- [OpenClaw Team Control](https://github.com/kevinelliott/openclaw-team-control) - Reference implementation
- ClawdBot Gateway Protocol v3
