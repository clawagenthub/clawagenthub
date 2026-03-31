# Agents List Empty - Root Cause Analysis & Solution

## Problem Statement

The ClawAgentHub UI shows "No agents available" despite having 11 agents configured in the local OpenClaw Gateway at `.openclaw/openclaw.json`.

**Observed Behavior:**
- API endpoint `/api/chat/agents` returns `{"agents":[]}`
- Browser console shows: "No agents available - check browser console for details"
- Local `.openclaw` folder contains 11 configured agents (main, architech, librarian, coder, tester, prompter, market, and 4 mc-gateway agents)

## Root Cause Analysis

### Architecture Understanding

**ClawAgentHub Architecture:**
```
ClawAgentHub Web App (Next.js)
    ↓
/api/chat/agents endpoint
    ↓
Database: gateways table (workspace-scoped)
    ↓
GatewayClient (WebSocket)
    ↓
OpenClaw Gateway (ws://localhost:18789)
    ↓
agents.list RPC method
```

**OpenClaw Gateway Architecture:**
- Runs locally on port 18789 (default)
- Stores agent configuration in `~/.openclaw/openclaw.json`
- Exposes WebSocket RPC API with method `agents.list`
- Requires authentication via token

### The Core Issue

**ClawAgentHub expects a multi-gateway architecture** where:
1. Gateways are registered in the database per workspace
2. Each gateway has a URL, auth token, and connection status
3. The system queries multiple gateways for their agents

**Current State:**
1. ❌ **No gateways registered in the database** - The `gateways` table is empty
2. ❌ **No gateway connection established** - ClawAgentHub has never connected to the local OpenClaw Gateway
3. ✅ **OpenClaw Gateway is running** - Agents are configured in `.openclaw/openclaw.json`
4. ✅ **Gateway client code exists** - [`lib/gateway/client.ts`](lib/gateway/client.ts) has the WebSocket implementation

### Code Flow Analysis

From [`app/api/chat/agents/route.ts`](app/api/chat/agents/route.ts:7-105):

```typescript
export async function GET(request: Request) {
  // 1. Get all gateways for the current workspace
  const gateways = db
    .prepare(`SELECT * FROM gateways WHERE workspace_id = ? AND status = 'connected'`)
    .all(auth.workspaceId) as Gateway[]
  
  // 2. If no gateways, return empty array
  if (gateways.length === 0) {
    return NextResponse.json({ agents: [] })  // ← THIS IS WHAT'S HAPPENING
  }
  
  // 3. For each gateway, call client.listAgents()
  for (const gateway of gateways) {
    const client = manager.getClient(gateway.id)
    const gatewayAgents = await client.listAgents()  // ← NEVER REACHED
    // ...
  }
}
```

**The query returns 0 gateways** because:
- The `gateways` table has no rows
- No gateway has been registered for the workspace
- Therefore, `client.listAgents()` is never called

### OpenClaw Gateway Configuration

From `.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "YOUR_GATEWAY_TOKEN"
    },
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://YOUR_SERVER_HOST:3000",
        // ... more origins
      ],
      "allowInsecureAuth": true
    }
  },
  "agents": {
    "list": [
      { "id": "main", ... },
      { "id": "architech", ... },
      { "id": "librarian", ... },
      { "id": "coder", ... },
      { "id": "tester", ... },
      { "id": "prompter", ... },
      { "id": "market", ... },
      { "id": "mc-gateway-498ebd8f-98aa-4c6c-ab80-ad5e81721bb0", ... },
      { "id": "mc-gateway-1799c661-5304-43b1-95c5-e6e7355b9ce4", ... },
      { "id": "mc-8c24e6e1-abb0-4ced-ac33-0dceae16dd9e", ... },
      { "id": "mc-gateway-3ab46053-ad53-4fc0-a793-f115c4c12157", ... }
    ]
  }
}
```

**Gateway is configured and ready:**
- ✅ Running on `ws://localhost:18789` (or `ws://127.0.0.1:18789`)
- ✅ Auth token: `YOUR_GATEWAY_TOKEN`
- ✅ 11 agents configured
- ✅ CORS origins include ClawAgentHub URLs

### OpenClaw Gateway Protocol

From the official OpenClaw documentation ([`docs/gateway/protocol.md`](https://github.com/openclaw/openclaw/blob/main/docs/gateway/protocol.md)):

**WebSocket RPC Protocol:**
- Frame types: `req` (request), `res` (response), `event`
- First frame must be a `connect` request with authentication
- After connection, clients can call RPC methods like `agents.list`

**Expected `agents.list` Response Format:**
```typescript
{
  agents: Array<{
    id: string
    name?: string
    workspace?: string
    model?: { primary: string }
    // ... other agent properties
  }>
}
```

## Solution Plan

### Phase 1: Gateway Registration (Required)

**Create a gateway registration system:**

1. **Add Gateway Management UI** (or API endpoint)
   - Allow users to register their local OpenClaw Gateway
   - Input: Gateway URL, auth token
   - Store in `gateways` table with workspace association

2. **Auto-discovery Option**
   - Detect local gateway at `ws://localhost:18789`
   - Attempt connection with common configurations
   - Prompt user for auth token if needed

3. **Database Entry**
   ```sql
   INSERT INTO gateways (id, workspace_id, name, url, auth_token, status)
   VALUES (
     'local-gateway',
     '<workspace_id>',
     'Local OpenClaw Gateway',
     'ws://localhost:18789',
     'YOUR_GATEWAY_TOKEN',
     'disconnected'
   );
   ```

### Phase 2: Gateway Connection Management

**Implement connection lifecycle:**

1. **Connection Establishment**
   - When gateway is registered, attempt WebSocket connection
   - Implement proper `connect` handshake per OpenClaw protocol
   - Update gateway status: `connecting` → `connected` or `error`

2. **Connection Monitoring**
   - Periodic health checks
   - Reconnection logic on disconnect
   - Update `last_connected_at` and `status` fields

3. **Error Handling**
   - Store connection errors in `last_error` field
   - Display meaningful error messages to users
   - Provide troubleshooting guidance

### Phase 3: Agents Discovery

**Enhance the agents listing:**

1. **Fix Current Implementation**
   - The code in [`app/api/chat/agents/route.ts`](app/api/chat/agents/route.ts) is correct
   - It just needs gateways to be registered first

2. **Add Caching**
   - Cache agent lists per gateway
   - Refresh periodically or on-demand
   - Reduce WebSocket calls

3. **Better Error Messages**
   - If no gateways: "No gateways configured. Please add a gateway."
   - If gateway disconnected: "Gateway disconnected. Check connection."
   - If agents.list fails: Show specific RPC error

### Phase 4: User Experience Improvements

1. **Setup Wizard**
   - First-time setup flow
   - Guide users to connect their local gateway
   - Test connection before saving

2. **Gateway Dashboard**
   - Show all registered gateways
   - Display connection status
   - List agents per gateway
   - Test connection button

3. **Better Error UI**
   - Replace generic "No agents available" message
   - Show actionable steps based on the actual issue
   - Link to gateway setup documentation

## Implementation Steps

### Step 1: Create Gateway Registration API

**File:** `app/api/gateways/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-auth'
import { GatewayClient } from '@/lib/gateway/client'

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  const { name, url, authToken } = await request.json()
  
  // Validate inputs
  if (!name || !url || !authToken) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }
  
  // Test connection
  const client = new GatewayClient(url, { authToken, origin: request.headers.get('origin') || '' })
  try {
    await client.connect()
    const health = await client.health()
    await client.disconnect()
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to connect to gateway', details: error.message },
      { status: 400 }
    )
  }
  
  // Save to database
  const db = getDb()
  const gatewayId = crypto.randomUUID()
  
  db.prepare(`
    INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, last_connected_at)
    VALUES (?, ?, ?, ?, ?, 'connected', CURRENT_TIMESTAMP)
  `).run(gatewayId, auth.workspaceId, name, url, authToken)
  
  return NextResponse.json({ id: gatewayId, name, url, status: 'connected' })
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  const db = getDb()
  
  const gateways = db
    .prepare('SELECT id, name, url, status, last_connected_at, last_error FROM gateways WHERE workspace_id = ?')
    .all(auth.workspaceId)
  
  return NextResponse.json({ gateways })
}
```

### Step 2: Create Gateway Setup UI

**File:** `app/(dashboard)/settings/gateways/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function GatewaysPage() {
  const [formData, setFormData] = useState({
    name: 'Local OpenClaw Gateway',
    url: 'ws://localhost:18789',
    authToken: ''
  })
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTesting(true)
    setError('')
    
    try {
      const response = await fetch('/api/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add gateway')
      }
      
      // Success - redirect or show success message
      window.location.href = '/chat'
    } catch (err) {
      setError(err.message)
    } finally {
      setTesting(false)
    }
  }
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add OpenClaw Gateway</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Gateway Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My Local Gateway"
          />
        </div>
        
        <div>
          <Label htmlFor="url">Gateway URL</Label>
          <Input
            id="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="ws://localhost:18789"
          />
          <p className="text-sm text-gray-500 mt-1">
            Default: ws://localhost:18789 or ws://127.0.0.1:18789
          </p>
        </div>
        
        <div>
          <Label htmlFor="authToken">Auth Token</Label>
          <Input
            id="authToken"
            type="password"
            value={formData.authToken}
            onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
            placeholder="Your gateway auth token"
          />
          <p className="text-sm text-gray-500 mt-1">
            Find this in ~/.openclaw/openclaw.json under gateway.auth.token
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <Button type="submit" disabled={testing}>
          {testing ? 'Testing Connection...' : 'Add Gateway'}
        </Button>
      </form>
    </div>
  )
}
```

### Step 3: Update Agent Selector UI

**File:** `components/chat/agent-selector.tsx`

Add better error messaging:

```typescript
if (isLoading) {
  return <div>Loading agents...</div>
}

if (error) {
  return (
    <div className="text-red-600">
      <p>Failed to load agents</p>
      <p className="text-sm">{error.message}</p>
    </div>
  )
}

if (!agents || agents.length === 0) {
  return (
    <div className="text-gray-600">
      <p>No agents available</p>
      <p className="text-sm mt-2">
        Please <a href="/settings/gateways" className="text-blue-600 underline">
          configure a gateway
        </a> to access agents.
      </p>
    </div>
  )
}
```

### Step 4: Quick Fix for Testing

**Immediate workaround to test the system:**

```bash
# Connect to your database
sqlite3 githubprojects/clawhub/data/clawhub.db

# Insert a gateway record (replace <workspace_id> with your actual workspace ID)
INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, last_connected_at, created_at, updated_at)
VALUES (
  'local-gateway-001',
  '<your-workspace-id>',
  'Local OpenClaw Gateway',
  'ws://localhost:18789',
  'YOUR_GATEWAY_TOKEN',
  'connected',
  datetime('now'),
  datetime('now'),
  datetime('now')
);
```

After this, restart your ClawAgentHub server and the agents should appear!

## Testing Checklist

- [ ] Gateway registration API works
- [ ] WebSocket connection establishes successfully
- [ ] `agents.list` RPC call returns agents
- [ ] Agents appear in the UI dropdown
- [ ] Can select an agent and start a chat
- [ ] Connection errors are handled gracefully
- [ ] Gateway status updates correctly

## Configuration Requirements

**For ClawAgentHub to work with OpenClaw Gateway:**

1. **OpenClaw Gateway must be running**
   ```bash
   openclaw gateway
   ```

2. **Gateway must allow ClawAgentHub origin**
   - Add ClawAgentHub URL to `gateway.controlUi.allowedOrigins` in `~/.openclaw/openclaw.json`
   - Or enable `dangerouslyAllowHostHeaderOriginFallback: true` (less secure)

3. **Auth token must match**
   - Token in ClawAgentHub database must match `gateway.auth.token` in OpenClaw config

4. **Network accessibility**
   - If ClawAgentHub runs on different machine, use LAN IP instead of localhost
   - Ensure firewall allows WebSocket connections on port 18789

## Next Steps

1. ✅ **Immediate:** Use the SQL quick fix to test the system
2. 🔨 **Short-term:** Implement gateway registration API and UI
3. 🚀 **Long-term:** Add auto-discovery, connection monitoring, and better UX

## Related Files

- [`app/api/chat/agents/route.ts`](app/api/chat/agents/route.ts) - Agents listing endpoint
- [`lib/gateway/client.ts`](lib/gateway/client.ts) - WebSocket client implementation
- [`lib/db/schema.ts`](lib/db/schema.ts) - Database schema including Gateway interface
- [`lib/db/migrations/004_add_gateways.sql`](lib/db/migrations/004_add_gateways.sql) - Gateways table schema
- [`.openclaw/openclaw.json`](.openclaw/openclaw.json) - Local OpenClaw Gateway configuration

## References

- [OpenClaw Gateway Protocol Documentation](https://docs.openclaw.ai/gateway/protocol)
- [OpenClaw GitHub Repository](https://github.com/openclaw/openclaw)
- OpenClaw WebSocket RPC methods: `connect`, `agents.list`, `health`, `chat.send`
