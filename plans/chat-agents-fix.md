# Chat Agents Fix Plan

## Problem Summary

The chat system on the right sidebar shows "No agents available" even though agents should be available from the OpenClaw Gateway. The user needs to see available agents and understand why errors are occurring.

## Root Cause Analysis

After reviewing the OpenClaw Gateway documentation and implementation:

1. **RPC Method is Correct**: The code uses `agents.list` which is the correct RPC method
2. **Missing Debug Logging**: There's no console logging to see what's happening during the API call
3. **Silent Failures**: Errors are caught but not logged, making debugging impossible
4. **Response Format Unknown**: We need to verify the actual response structure from the gateway

## OpenClaw Gateway Protocol

Based on the official OpenClaw repository:

### RPC Method: `agents.list`
- **Location**: [`src/gateway/server-methods/agents.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/agents.ts)
- **Handler**: `agentsHandlers["agents.list"]`
- **Implementation**: Calls `listAgentsForGateway(cfg)` from [`src/gateway/session-utils.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/session-utils.ts)

### Expected Response Format
```typescript
{
  agents: Array<{
    id: string;
    name?: string;
    // ... other properties
  }>
}
```

## Current Implementation Issues

### 1. Gateway Client ([`lib/gateway/client.ts`](lib/gateway/client.ts:391))
```typescript
async listAgents(): Promise<GatewayAgent[]> {
  const result = (await this.call('agents.list', {})) as {
    agents?: GatewayAgent[]
  }
  return result?.agents ?? []
}
```
**Issues:**
- No error logging
- No console output for debugging
- Silent failure returns empty array

### 2. API Route ([`app/api/chat/agents/route.ts`](app/api/chat/agents/route.ts:6))
```typescript
export async function GET(request: Request) {
  try {
    // ... gateway connection logic
    const gatewayAgents = await client.listAgents()
    // ... processing
  } catch (error) {
    console.error('Failed to fetch agents:', error)
    return NextResponse.json({ agents: [] }, { status: 500 })
  }
}
```
**Issues:**
- Limited error context
- No logging of gateway response
- No visibility into what the gateway returns

### 3. UI Component ([`components/chat/agent-selector.tsx`](components/chat/agent-selector.tsx:38))
```typescript
<option value="">
  {loading
    ? 'Loading agents...'
    : agents.length === 0
    ? 'No agents available'
    : 'Choose an agent...'}
</option>
```
**Issues:**
- No error state display
- User doesn't know why agents aren't available

## Solution Plan

### Phase 1: Add Comprehensive Logging

#### 1.1 Update Gateway Client
**File**: [`lib/gateway/client.ts`](lib/gateway/client.ts:391)

Add logging to the `listAgents()` method:
```typescript
async listAgents(): Promise<GatewayAgent[]> {
  console.log('[GatewayClient] Calling agents.list RPC method')
  try {
    const result = (await this.call('agents.list', {})) as {
      agents?: GatewayAgent[]
    }
    console.log('[GatewayClient] agents.list response:', {
      hasAgents: !!result?.agents,
      agentCount: result?.agents?.length ?? 0,
      agents: result?.agents
    })
    return result?.agents ?? []
  } catch (error) {
    console.error('[GatewayClient] Error calling agents.list:', error)
    throw error
  }
}
```

#### 1.2 Update API Route
**File**: [`app/api/chat/agents/route.ts`](app/api/chat/agents/route.ts:6)

Add detailed logging throughout the request:
```typescript
export async function GET(request: Request) {
  console.log('[API /api/chat/agents] Starting request')
  
  try {
    const session = await getServerSession(authOptions)
    console.log('[API /api/chat/agents] Session:', {
      hasSession: !!session,
      userId: session?.user?.id
    })

    if (!session?.user?.id) {
      console.log('[API /api/chat/agents] No session, returning empty agents')
      return NextResponse.json({ agents: [] })
    }

    const gateways = await db.query.gateways.findMany({
      where: eq(gateways.userId, session.user.id),
    })
    console.log('[API /api/chat/agents] Found gateways:', {
      count: gateways.length,
      gateways: gateways.map(g => ({ id: g.id, name: g.name, url: g.url }))
    })

    const agents: AgentInfo[] = []

    for (const gateway of gateways) {
      console.log(`[API /api/chat/agents] Connecting to gateway: ${gateway.name} (${gateway.url})`)
      
      const client = new GatewayClient(gateway.url, {
        authToken: gateway.token,
        origin: 'clawhub',
      })

      try {
        await client.connect()
        console.log(`[API /api/chat/agents] Connected to gateway: ${gateway.name}`)
        
        const gatewayAgents = await client.listAgents()
        console.log(`[API /api/chat/agents] Gateway ${gateway.name} returned agents:`, {
          count: gatewayAgents.length,
          agents: gatewayAgents
        })

        for (const agent of gatewayAgents) {
          const agentInfo = {
            gatewayId: gateway.id,
            gatewayName: gateway.name,
            agentId: agent.id,
            agentName: agent.name || agent.id,
            sessionKey: agent.sessionKey || `agent:${agent.id}:main`
          }
          console.log(`[API /api/chat/agents] Adding agent:`, agentInfo)
          agents.push(agentInfo)
        }

        client.disconnect()
      } catch (error) {
        console.error(`[API /api/chat/agents] Error with gateway ${gateway.name}:`, {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      }
    }

    console.log('[API /api/chat/agents] Final agents list:', {
      count: agents.length,
      agents
    })
    return NextResponse.json({ agents })
  } catch (error) {
    console.error('[API /api/chat/agents] Fatal error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ agents: [] }, { status: 500 })
  }
}
```

### Phase 2: Improve Error Handling

#### 2.1 Add Error State to UI
**File**: [`components/chat/agent-selector.tsx`](components/chat/agent-selector.tsx:13)

Update the component to show error states:
```typescript
interface AgentSelectorProps {
  agents: AgentInfo[]
  selectedAgent: string | null
  onSelect: (agentKey: string) => void
  loading?: boolean
  error?: string // Add error prop
}

export function AgentSelector({ 
  agents, 
  selectedAgent, 
  onSelect, 
  loading = false,
  error 
}: AgentSelectorProps) {
  return (
    <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
      <label className="block text-sm font-medium mb-2">
        Select Agent
      </label>
      <select
        value={selectedAgent || ''}
        onChange={(e) => {
          const value = e.target.value
          if (value) onSelect(value)
        }}
        className="w-full px-3 py-2 rounded-md border"
        style={{
          backgroundColor: 'rgb(var(--background))',
          borderColor: 'rgb(var(--border-color))',
          color: 'rgb(var(--foreground))',
        }}
        disabled={loading}
      >
        <option value="">
          {loading
            ? 'Loading agents...'
            : error
            ? `Error: ${error}`
            : agents.length === 0
            ? 'No agents available - check console for details'
            : 'Choose an agent...'}
        </option>
        {agents.map((agent) => (
          <option
            key={`${agent.gatewayId}-${agent.agentId}`}
            value={`${agent.gatewayId}:${agent.agentId}`}
          >
            {agent.agentName} ({agent.gatewayName})
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-2 text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
```

#### 2.2 Update Chat Panel to Pass Error
**File**: [`components/chat/chat-panel.tsx`](components/chat/chat-panel.tsx)

Pass error state from React Query to the AgentSelector.

### Phase 3: Verify Gateway Configuration

#### 3.1 Check Gateway Connection
Ensure the gateway is:
1. Running and accessible at the configured URL
2. Using the correct authentication token
3. Has agents configured in its config file

#### 3.2 Test RPC Call Manually
Use the browser console or a test script to verify the RPC call works:
```javascript
// In browser console after connecting to gateway
const ws = new WebSocket('ws://localhost:18789')
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'req',
    id: 'test-1',
    method: 'agents.list',
    params: {}
  }))
}
ws.onmessage = (event) => {
  console.log('Response:', JSON.parse(event.data))
}
```

## Implementation Steps

1. **Add Logging** (Priority: HIGH)
   - Update [`lib/gateway/client.ts`](lib/gateway/client.ts:391) with logging
   - Update [`app/api/chat/agents/route.ts`](app/api/chat/agents/route.ts:6) with comprehensive logging
   - Deploy and check browser console + server logs

2. **Improve Error Display** (Priority: MEDIUM)
   - Update [`components/chat/agent-selector.tsx`](components/chat/agent-selector.tsx:13) with error state
   - Update [`components/chat/chat-panel.tsx`](components/chat/chat-panel.tsx) to pass errors
   - Test error scenarios

3. **Verify Gateway** (Priority: HIGH)
   - Check gateway is running
   - Verify authentication token matches
   - Confirm agents are configured
   - Test RPC call manually

4. **Test & Validate** (Priority: HIGH)
   - Check console logs for detailed error information
   - Verify agents appear in the dropdown
   - Test agent selection and chat functionality

## Expected Outcomes

After implementing these changes:

1. **Visibility**: Console logs will show exactly what's happening at each step
2. **Error Context**: Users will see meaningful error messages instead of "No agents available"
3. **Debugging**: Developers can quickly identify if the issue is:
   - Gateway connection failure
   - Authentication problem
   - Empty agents list from gateway
   - Response format mismatch
   - Network/timeout issues

## Testing Checklist

- [ ] Console shows gateway connection attempt
- [ ] Console shows RPC call to `agents.list`
- [ ] Console shows raw response from gateway
- [ ] Console shows processed agents list
- [ ] UI shows agents in dropdown (if available)
- [ ] UI shows meaningful error message (if error occurs)
- [ ] Error details are visible in console
- [ ] Agent selection works correctly

## References

- [OpenClaw Gateway Protocol Documentation](https://github.com/openclaw/openclaw/blob/main/docs/gateway/protocol.md)
- [OpenClaw agents.list Implementation](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods/agents.ts)
- [OpenClaw Session Utils](https://github.com/openclaw/openclaw/blob/main/src/gateway/session-utils.ts)
