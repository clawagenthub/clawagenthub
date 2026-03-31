# OpenClaw Chat Send Flow Diagram

## Current (Broken) Flow

```mermaid
sequenceDiagram
    participant UI as ClawAgentHub UI
    participant API as Next.js API
    participant GW as Gateway Client
    participant OC as OpenClaw Gateway
    
    UI->>API: POST /api/chat/sessions/{id}/messages
    API->>GW: sendAgentMessage(sessionKey, message)
    GW->>OC: RPC: sessions.send
    OC-->>GW: ERROR: unknown method
    GW-->>API: Error thrown
    API-->>UI: 500 Error
    
    Note over OC: sessions.send does NOT exist in v3.2
```

## Fixed Flow (Correct Implementation)

```mermaid
sequenceDiagram
    participant UI as ClawAgentHub UI
    participant API as Next.js API
    participant GW as Gateway Client
    participant OC as OpenClaw Gateway
    participant Agent as OpenClaw Agent
    
    UI->>API: POST /api/chat/sessions/{id}/messages
    API->>GW: sendChatMessageAndWait(sessionKey, message)
    
    Note over GW: Generate idempotencyKey
    
    GW->>OC: RPC: chat.send {sessionKey, message, idempotencyKey}
    OC-->>GW: {runId, status: started}
    
    Note over GW: Wait for chat event
    
    OC->>Agent: Process message
    Agent->>Agent: Generate response
    Agent-->>OC: Response ready
    
    OC->>GW: WebSocket Event: chat {runId, state: delta, delta: ...}
    OC->>GW: WebSocket Event: chat {runId, state: delta, delta: ...}
    OC->>GW: WebSocket Event: chat {runId, state: final, message: {...}}
    
    GW-->>API: {runId, message}
    API-->>UI: 200 OK {success, runId, message}
    UI->>UI: Display response
```

## Method Comparison

### Old (Incorrect) Method: sessions.send

```typescript
// Does NOT exist in OpenClaw v3.2
await gateway.call('sessions.send', {
  sessionKey: 'main',
  message: 'Hello',
  metadata: { label: 'clawhub' }  // Not supported
})
```

**Result**: `unknown method: sessions.send`

### New (Correct) Method: chat.send

```typescript
// Correct method for OpenClaw v3.2
await gateway.call('chat.send', {
  sessionKey: 'main',
  message: 'Hello',
  idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',  // Required
  deliver: false,        // Optional
  thinking: undefined,   // Optional
  timeoutMs: 120000     // Optional
})
```

**Result**: `{runId: '550e8400...', status: 'started'}`

Then listen for events:
```typescript
gateway.onEvent('chat', (event) => {
  if (event.runId === '550e8400...') {
    if (event.state === 'final') {
      console.log('Response:', event.message)
    }
  }
})
```

## Available Gateway Methods (OpenClaw v3.2)

```mermaid
graph TD
    A[Gateway Methods] --> B[Sessions]
    A --> C[Chat]
    A --> D[Send]
    A --> E[Other]
    
    B --> B1[sessions.list]
    B --> B2[sessions.get]
    B --> B3[sessions.preview]
    B --> B4[sessions.resolve]
    B --> B5[sessions.patch]
    B --> B6[sessions.reset]
    B --> B7[sessions.delete]
    B --> B8[sessions.compact]
    
    C --> C1[chat.history]
    C --> C2[chat.send ✅]
    C --> C3[chat.abort]
    C --> C4[chat.inject]
    
    D --> D1[send - External channels]
    D --> D2[poll - External polls]
    
    E --> E1[health]
    E --> E2[agents.list]
    E --> E3[config.*]
    E --> E4[logs.*]
    
    style C2 fill:#90EE90
    style B fill:#FFE4E1
    style C fill:#E0FFE0
```

## Event Types

```mermaid
graph LR
    A[WebSocket Events] --> B[chat]
    A --> C[logs]
    A --> D[agents]
    A --> E[health]
    
    B --> B1[state: delta]
    B --> B2[state: final]
    B --> B3[state: error]
    
    B1 --> B1A[Streaming text chunks]
    B2 --> B2A[Complete message]
    B3 --> B3A[Error message]
```

## Implementation Architecture

```mermaid
graph TB
    subgraph ClawAgentHub
        UI[React UI Components]
        API[Next.js API Routes]
        GWC[Gateway Client Library]
    end
    
    subgraph OpenClaw
        GWS[Gateway Server]
        AGT[Agent Runtime]
        SESS[Session Manager]
    end
    
    UI -->|HTTP POST| API
    API -->|sendChatMessageAndWait| GWC
    GWC -->|WebSocket RPC| GWS
    GWS -->|dispatch| AGT
    AGT -->|read/write| SESS
    AGT -->|response| GWS
    GWS -->|WebSocket Event| GWC
    GWC -->|Promise resolve| API
    API -->|JSON response| UI
    
    style GWC fill:#FFE4B5
    style GWS fill:#E0FFE0
```

## Key Differences

| Aspect | Old (sessions.send) | New (chat.send) |
|--------|-------------------|-----------------|
| **Exists?** | ❌ No | ✅ Yes |
| **Method** | `sessions.send` | `chat.send` |
| **idempotencyKey** | ❌ Not used | ✅ Required |
| **metadata** | ✅ Sent (ignored) | ❌ Not supported |
| **Response** | N/A (error) | `{runId, status}` |
| **Async** | N/A | ✅ Events via WebSocket |
| **Streaming** | N/A | ✅ Supported (delta events) |

## Migration Path

```mermaid
graph LR
    A[Current Code] -->|1. Update method name| B[Use chat.send]
    B -->|2. Add idempotencyKey| C[Generate UUID]
    C -->|3. Remove metadata| D[Clean params]
    D -->|4. Handle async| E[Listen for events]
    E -->|5. Test| F[Verify with gateway]
    F -->|6. Deploy| G[Production]
    
    style A fill:#FFB6C1
    style G fill:#90EE90
```
