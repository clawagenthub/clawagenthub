# Agent Dropdown and Dashboard Priority Update Plan

## Overview
Two new features to implement:
1. **Agent Dropdown** - Replace text input with dropdown showing `gatewayname:agentname` format with "None" option
2. **Dashboard Drag-Drop Priority Persistence** - When boards are reordered via drag-drop, persist priority changes to database

## Architecture

```mermaid
flowchart TB
    subgraph "Agent Dropdown Feature"
        API1["/api/chat/agents"] --> |returns agents| HOOK1["useAgents hook"]
        HOOK1 --> |AgentInfo[]| FORM["StatusForm"]
        FORM --> |dropdown| SELECT["Agent Selector"]
        SELECT --> |"gatewayname:agentname"| API2["/api/statuses"]
    end

    subgraph "Dashboard Drag-Drop Priority Update"
        DASH["Dashboard"] --> |drag board| DRAG["onDrop handler"]
        DRAG --> |calculate new priorities| API3["/api/statuses/reorder"]
        API3 --> |batch update priorities| DB[(SQLite Database)]
        DB --> |returns updated| HOOK2["useStatuses hook"]
        HOOK2 --> |refetch| DASH
    end
```

## Part 1: Agent Dropdown Feature

### Current State
- `agent_id` is a free-text input field in status-form.tsx
- No integration with available agents from gateways
- `/api/chat/agents` already returns agents with `gatewayName` and `agentName`

### Implementation Steps

#### 1. Update StatusForm Component
- Import `useAgents` hook from `lib/query/hooks/useChat.ts`
- Replace text input with dropdown selector
- Add "None" option (value: null or empty string)
- Format options as `gatewayname:agentname`
- Store agent_id as `agentId` (from AgentInfo) for proper association

```typescript
// Agent info structure from /api/chat/agents
interface AgentInfo {
  gatewayId: string
  gatewayName: string
  agentId: string
  agentName: string
  sessionKey: string
}
```

#### 2. Update StatusCard Display
- When agent_id is set, display as `gatewayname:agentname`
- Add visual indicator for assigned agent

#### 3. Data Storage Format
- `agent_id` stores just the agent ID string
- Display format: `gatewayname:agentname`
- This requires looking up the agent to get gateway name for display

### Alternative Approach: Store Combined Value
- Store `agent_id` as `gatewayId:agentId` format
- Simpler for display and lookup
- Migration 017 already created, no change needed

## Part 2: Dashboard Drag-Drop Priority Update

### Current State
- Dashboard has drag-drop handlers but only for visual feedback
- Priority changes require going to status edit modal
- No persistence of board order changes

### Implementation Steps

#### 1. Create Reorder API Endpoint
New endpoint: `PATCH /api/statuses/reorder`

Request body:
```typescript
{
  statuses: [
    { id: string, priority: number },
    ...
  ]
}
```

#### 2. Update useStatuses Hook
Add new mutation: `useReorderStatuses`

```typescript
export function useReorderStatuses() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (statuses: Array<{ id: string; priority: number }>) => {
      const res = await fetch('/api/statuses/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statuses }),
      })
      // ...
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] })
    },
  })
}
```

#### 3. Update Dashboard Drag-Drop Handler
```typescript
const handleDrop = (e: React.DragEvent, targetStatusId: string) => {
  e.preventDefault()
  
  if (!draggedStatusId || draggedStatusId === targetStatusId) {
    return
  }

  const draggedIndex = statuses.findIndex((s) => s.id === draggedStatusId)
  const targetIndex = statuses.findIndex((s) => s.id === targetStatusId)

  // Create new array with reordered items
  const newStatuses = [...statuses]
  const [draggedStatus] = newStatuses.splice(draggedIndex, 1)
  newStatuses.splice(targetIndex, 0, draggedStatus)

  // Calculate new priorities based on position
  const updates = newStatuses.map((status, index) => ({
    id: status.id,
    priority: index + 1  // 1-based priority
  }))

  // Persist to database
  reorderStatuses(updates)
}
```

## Files to Modify

### Agent Dropdown
1. `components/status/status-form.tsx` - Add agent dropdown with useAgents
2. `components/status/status-card.tsx` - Update agent display format
3. `lib/query/hooks/index.ts` - Export useAgents

### Dashboard Priority Update
4. `app/api/statuses/reorder/route.ts` (NEW) - Batch update priorities endpoint
5. `lib/query/hooks/useStatuses.ts` - Add useReorderStatuses mutation
6. `components/pages/dashboard-content.tsx` - Implement priority persistence in handleDrop
7. `lib/query/hooks/index.ts` - Export useReorderStatuses

## API Contract

### GET /api/chat/agents (existing)
Response:
```json
{
  "agents": [
    {
      "gatewayId": "gw-123",
      "gatewayName": "My Gateway",
      "agentId": "agent-456",
      "agentName": "Claude",
      "sessionKey": "agent:agent-456:main"
    }
  ]
}
```

### PATCH /api/statuses/reorder (NEW)
Request:
```json
{
  "statuses": [
    { "id": "status-1", "priority": 1 },
    { "id": "status-2", "priority": 2 }
  ]
}
```

Response:
```json
{
  "success": true,
  "updated": 2
}
```

## Edge Cases

### Agent Dropdown
- No agents available (show only "None" option)
- Gateway disconnected (agent not listed)
- Agent deleted from gateway (show "Unknown Agent" or "None")

### Dashboard Reorder
- Single status (no reordering possible)
- Concurrent drag operations (use optimistic updates)
- Network failure during reorder (show error, rollback UI)

## UI/UX Considerations

### Agent Dropdown
- Show loading state while fetching agents
- Display agent names clearly with gateway context
- "None" option should be first or clearly marked
- Optional: Show connection status of gateway

### Dashboard Reorder
- Visual feedback during drag (highlight drop target)
- Smooth animation when priority updates
- Optimistic UI update (reflect change immediately)
- Error handling with retry option
