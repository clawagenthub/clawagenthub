# GatewayService

A singleton service for managing gateway connections and state on the frontend. Provides event-based state management, auto-reconnection logic, and React hooks for seamless integration.

## Features

- **Singleton Pattern**: Single shared instance across all components
- **Event Emitter**: Subscribe to state changes for reactive updates
- **Auto-Reconnection**: Attempts reconnection once when gateway is not loading
- **Type-Safe**: Full TypeScript support with exported types
- **React Hooks**: Easy-to-use hooks for consuming the service

## Quick Start

```tsx
import { useGatewayAgents, useGatewayConnection } from '@/lib/hooks/useGatewayService'

function MyComponent() {
  const { agents, isLoadingAgents } = useGatewayAgents()
  const { isConnected, tryReconnect } = useGatewayConnection()

  if (!isConnected) {
    return <button onClick={tryReconnect}>Reconnect</button>
  }

  return (
    <ul>
      {agents.map(agent => (
        <li key={agent.agentId}>{agent.agentName}</li>
      ))}
    </ul>
  )
}
```

## Installation

The GatewayService is already included in the ClawAgentHub project. All files are located in:

```
lib/
├── services/
│   ├── service-event-emitter.ts    # Core event emitter utility
│   └── gateway-service.ts          # GatewayService singleton
└── hooks/
    └── useGatewayService.ts        # React hooks
```

## API Reference

### React Hooks

#### `useGatewayService()`

Get the full service state. Automatically re-renders on any state change.

```tsx
const state = useGatewayService()

console.log(state.isConnected)
console.log(state.agents)
console.log(state.isLoading)
```

**Returns:** `GatewayServiceState`

| Property | Type | Description |
|----------|------|-------------|
| `isLoading` | `boolean` | General loading state |
| `isConnecting` | `boolean` | Currently connecting to gateway |
| `isConnected` | `boolean` | Gateway is connected |
| `connectionError` | `string \| null` | Connection error message |
| `gateways` | `Gateway[]` | List of gateways |
| `activeGatewayId` | `string \| null` | Currently active gateway ID |
| `agents` | `AgentInfo[]` | List of available agents |
| `isLoadingAgents` | `boolean` | Currently loading agents |
| `reconnectAttempts` | `number` | Number of reconnection attempts |
| `lastReconnectAttempt` | `number \| null` | Timestamp of last reconnect |
| `isInitialized` | `boolean` | Service has been initialized |

---

#### `useGatewayServiceValue(selector)`

Subscribe to a specific slice of state. Only re-renders when the selected value changes.

```tsx
// Only re-renders when agents change
const agents = useGatewayServiceValue(state => state.agents)

// Only re-renders when connection status changes
const isConnected = useGatewayServiceValue(state => state.isConnected)
```

**Parameters:**
- `selector: (state: GatewayServiceState) => T` - Function to select a value from state

**Returns:** `T` - The selected value

---

#### `useGatewayServiceActions()` / `useSetGatewayService()`

Get actions to modify the service state. These don't trigger re-renders.

```tsx
const { refreshAgents, tryReconnect, connectGateway } = useGatewayServiceActions()
```

**Returns:** `GatewayServiceActions`

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `refreshGateways()` | - | `Promise<Gateway[]>` | Refetch gateways from API |
| `connectGateway(gatewayId)` | `gatewayId: string` | `Promise<void>` | Connect to a gateway |
| `disconnectGateway(gatewayId)` | `gatewayId: string` | `Promise<void>` | Disconnect from gateway |
| `checkHealth(gatewayId)` | `gatewayId: string` | `Promise<{healthy: boolean, message?: string}>` | Check gateway health |
| `refreshAgents()` | - | `Promise<AgentInfo[]>` | Refetch agents from connected gateways |
| `tryReconnect()` | - | `Promise<boolean>` | Attempt reconnection once |
| `initialize()` | - | `Promise<void>` | Initialize the service |

---

#### `useGatewayAgents()`

Convenience hook for agent-related state and actions.

```tsx
const { agents, isLoadingAgents, refreshAgents } = useGatewayAgents()
```

**Returns:**
```tsx
{
  agents: AgentInfo[]
  isLoadingAgents: boolean
  refreshAgents: () => Promise<AgentInfo[]>
}
```

---

#### `useGatewayConnection()`

Convenience hook for connection-related state and actions.

```tsx
const { isConnected, isLoading, connectionError, tryReconnect } = useGatewayConnection()
```

**Returns:**
```tsx
{
  isConnected: boolean
  isLoading: boolean
  isConnecting: boolean
  connectionError: string | null
  activeGatewayId: string | null
  tryReconnect: () => Promise<boolean>
}
```

---

#### `useGatewayList()`

Convenience hook for gateway list and actions.

```tsx
const { gateways, activeGatewayId, connectGateway } = useGatewayList()
```

**Returns:**
```tsx
{
  gateways: Gateway[]
  activeGatewayId: string | null
  refreshGateways: () => Promise<Gateway[]>
  connectGateway: (gatewayId: string) => Promise<void>
  disconnectGateway: (gatewayId: string) => Promise<void>
}
```

---

#### `useGatewayEvent(event, callback, deps?)`

Subscribe to specific gateway events.

```tsx
useGatewayEvent('gateway:connected', ({ gatewayId }) => {
  console.log('Gateway connected:', gatewayId)
})
```

**Parameters:**
- `event: keyof GatewayServiceEvents` - Event name to listen to
- `callback: (payload) => void` - Callback function
- `deps?: DependencyList` - Additional dependencies

**Available Events:**
| Event | Payload | Description |
|-------|---------|-------------|
| `state:change` | `GatewayServiceState` | Any state change |
| `gateway:connecting` | `{ gatewayId: string }` | Connection started |
| `gateway:connected` | `{ gatewayId, gateway }` | Connection successful |
| `gateway:disconnected` | `{ gatewayId }` | Disconnected |
| `gateway:error` | `{ gatewayId, error }` | Error occurred |
| `agents:loading` | `void` | Started loading agents |
| `agents:loaded` | `{ agents }` | Agents loaded |
| `agents:error` | `{ error }` | Failed to load agents |
| `reconnect:attempt` | `{ gatewayId }` | Reconnection started |
| `reconnect:success` | `{ gatewayId }` | Reconnection successful |
| `reconnect:failed` | `{ gatewayId, error }` | Reconnection failed |

---

### Direct Service Access

#### `getGatewayService()`

Get the singleton service instance directly.

```tsx
import { getGatewayService } from '@/lib/services/gateway-service'

const service = getGatewayService()
const state = service.getState()

// Subscribe to state changes
const unsubscribe = service.subscribe((state) => {
  console.log('State changed:', state)
})

// Listen to specific events
const unsubscribe = service.on('gateway:connected', ({ gatewayId }) => {
  console.log('Connected to:', gatewayId)
})
```

---

## Auto-Reconnection Logic

The GatewayService includes automatic reconnection that follows these rules:

1. **Trigger Conditions:**
   - Gateway health check fails
   - Gateway connection is lost
   - Explicit call to `tryReconnect()`

2. **Reconnection Behavior:**
   - Only attempts **once** (no retry loop)
   - Only attempts when gateway is **not loading** (`isConnecting: false`)
   - Resets connection error on success
   - Increments `reconnectAttempts` counter

3. **Flow Diagram:**
```
Connection Lost / Health Check Failed
         │
         ▼
    isConnecting?
         │
    ┌────┴────┐
    │         │
   Yes       No
    │         │
    │         ▼
    │    reconnectAttempts < 1?
    │         │
    │    ┌────┴────┐
    │    │         │
    │   No       Yes
    │    │         │
    │    │         ▼
    │    │    Set isConnecting: true
    │    │         │
    │    │         ▼
    │    │    Call /api/gateways/:id/connect
    │    │         │
    │    │         ▼
    │    │    Success?
    │    │         │
    │    │    ┌────┴────┐
    │    │    │         │
    │    │   No       Yes
    │    │    │         │
    │    │    ▼         ▼
    │    │  Set error  Set isConnected: true
    │    │    │         │
    │    └────┴─────────┘
    │         │
    └─────────┘
              │
              ▼
       Set isConnecting: false
```

---

## Usage Examples

### Display Connection Status

```tsx
import { useGatewayConnection } from '@/lib/hooks/useGatewayService'

function ConnectionStatus() {
  const { isConnected, isLoading, connectionError } = useGatewayConnection()

  if (isLoading) return <div>Connecting to gateway...</div>

  if (!isConnected) {
    return (
      <div className="alert alert-error">
        <p>Gateway disconnected: {connectionError}</p>
      </div>
    )
  }

  return <div className="alert alert-success">Gateway connected</div>
}
```

### List Available Agents

```tsx
import { useGatewayAgents } from '@/lib/hooks/useGatewayService'

function AgentList() {
  const { agents, isLoadingAgents, refreshAgents } = useGatewayAgents()

  if (isLoadingAgents) return <div>Loading agents...</div>

  return (
    <div>
      <button onClick={refreshAgents}>Refresh</button>
      <ul>
        {agents.map(agent => (
          <li key={agent.agentId}>
            {agent.agentName} (from {agent.gatewayName})
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Gateway List with Actions

```tsx
import { useGatewayList } from '@/lib/hooks/useGatewayService'

function GatewayList() {
  const { gateways, activeGatewayId, connectGateway } = useGatewayList()

  return (
    <ul>
      {gateways.map(gateway => (
        <li key={gateway.id}>
          <span>{gateway.name}</span>
          <span className="status">{gateway.status}</span>
          {gateway.id !== activeGatewayId && (
            <button onClick={() => connectGateway(gateway.id)}>
              Connect
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
```

### Handle Connection Events

```tsx
import { useGatewayEvent } from '@/lib/hooks/useGatewayService'

function ConnectionLogger() {
  useGatewayEvent('gateway:connected', ({ gatewayId }) => {
    console.log('✅ Gateway connected:', gatewayId)
  })

  useGatewayEvent('gateway:error', ({ gatewayId, error }) => {
    console.error('❌ Gateway error:', gatewayId, error)
  })

  useGatewayEvent('reconnect:success', ({ gatewayId }) => {
    console.log('🔄 Reconnected to:', gatewayId)
  })

  return null // This component only logs events
}
```

### Custom Reconnection Button

```tsx
import { useGatewayConnection } from '@/lib/hooks/useGatewayService'

function ReconnectButton() {
  const { isConnected, connectionError, tryReconnect } = useGatewayConnection()

  if (isConnected) return null

  return (
    <div className="reconnect-prompt">
      <p>Connection lost: {connectionError}</p>
      <button onClick={tryReconnect}>
        Try Reconnecting
      </button>
    </div>
  )
}
```

---

## Advanced: Direct Service Usage

For advanced use cases, you can access the service directly:

```tsx
import { getGatewayService } from '@/lib/services/gateway-service'

// Get current state
const service = getGatewayService()
const state = service.getState()

// Subscribe to state changes
const unsubscribe = service.subscribe((newState) => {
  console.log('State updated:', newState)
})

// Listen to specific events
const off = service.on('gateway:connected', ({ gatewayId, gateway }) => {
  console.log('Connected to', gateway.name)
})

// Call service methods
await service.connectGateway('gateway-123')
await service.refreshAgents()

// Cleanup
unsubscribe()
off()
```

---

## Testing

The GatewayService can be reset for testing:

```tsx
import { resetGatewayService } from '@/lib/services/gateway-service'

afterEach(() => {
  resetGatewayService()
})
```

---

## TypeScript Types

All types are exported for use in your code:

```tsx
import type {
  GatewayServiceState,
  GatewayServiceClass,
  GatewayServiceEvents,
  GatewayServiceActions
} from '@/lib/hooks/useGatewayService'
```

---

## Notes

- The GatewayService is **browser-only** - it uses browser APIs like `fetch`
- State is **not persisted** to localStorage - it resets on page refresh
- Reconnection is **single attempt only** by design
- All API calls use `credentials: 'include'` for cookie-based auth
