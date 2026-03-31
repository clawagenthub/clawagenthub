# Ticket System Design - Updated for Ticket-Specific Flows

## Key Architecture Change

**Flow configuration is ticket-specific, not global.**

- **Statuses table**: Stores default/global configurations as templates
- **Ticket flow**: Each ticket can customize its flow independently during creation

---

## Database Schema Design

### 1. Statuses Table (Global Defaults)
The `statuses` table stores **default configurations** that serve as templates when creating tickets.

```sql
ALTER TABLE statuses ADD COLUMN priority INTEGER DEFAULT 0;
ALTER TABLE statuses ADD COLUMN agent_id TEXT;
ALTER TABLE statuses ADD COLUMN on_failed_goto TEXT;
ALTER TABLE statuses ADD COLUMN is_flow_included INTEGER DEFAULT 1;
ALTER TABLE statuses ADD COLUMN ask_approve_to_continue INTEGER DEFAULT 0;
ALTER TABLE statuses ADD COLUMN instructions_override TEXT;
ALTER TABLE statuses ADD COLUMN is_system_status INTEGER DEFAULT 0;

CREATE INDEX idx_statuses_priority ON statuses(workspace_id, priority);
CREATE INDEX idx_statuses_agent_id ON statuses(agent_id);
```

### 2. Tickets Table (Simplified - No flow storage)
```sql
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  ticket_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  assigned_to TEXT,
  flow_enabled INTEGER DEFAULT 1,
  current_agent_session_id TEXT,
  last_flow_check_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  UNIQUE(workspace_id, ticket_number)
);

CREATE INDEX idx_tickets_workspace_number ON tickets(workspace_id, ticket_number);
CREATE INDEX idx_tickets_status_id ON tickets(status_id);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
```

### 3. Ticket Flow Config Table (NEW - Ticket-Specific Flow)
Each ticket can have its own customized flow configuration.

```sql
CREATE TABLE IF NOT EXISTS ticket_flow_configs (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  status_id TEXT NOT NULL, -- reference to the statuses table
  flow_order INTEGER NOT NULL, -- priority/order in this ticket's flow
  agent_id TEXT, -- override: can be different from status.default_agent_id
  on_failed_goto TEXT, -- override: status_id to move to on failure
  ask_approve_to_continue INTEGER DEFAULT 0, -- override: boolean
  instructions_override TEXT, -- override: markdown for this specific ticket
  is_included INTEGER DEFAULT 1, -- whether this status is in the flow
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  FOREIGN KEY (agent_id) REFERENCES users(id),
  UNIQUE(ticket_id, status_id)
);

CREATE INDEX idx_ticket_flow_configs_ticket_id ON ticket_flow_configs(ticket_id);
CREATE INDEX idx_ticket_flow_configs_flow_order ON ticket_flow_configs(ticket_id, flow_order);
CREATE INDEX idx_ticket_flow_configs_status_id ON ticket_flow_configs(status_id);
```

### 4. Ticket Comments Table
```sql
CREATE TABLE IF NOT EXISTS ticket_comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_agent_completion_signal INTEGER DEFAULT 0,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
```

### 5. Ticket Audit Log Table
```sql
CREATE TABLE IF NOT EXISTS ticket_audit_logs (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'user',
  old_value TEXT,
  new_value TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE INDEX idx_ticket_audit_logs_ticket_id ON ticket_audit_logs(ticket_id);
CREATE INDEX idx_ticket_audit_logs_created_at ON ticket_audit_logs(created_at DESC);
CREATE INDEX idx_ticket_audit_logs_event_type ON ticket_audit_logs(event_type);
```

### 6. Ticket Flow History Table
```sql
CREATE TABLE IF NOT EXISTS ticket_flow_history (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  from_status_id TEXT,
  to_status_id TEXT NOT NULL,
  agent_id TEXT,
  session_id TEXT,
  flow_result TEXT NOT NULL,
  failure_reason TEXT,
  notes TEXT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (from_status_id) REFERENCES statuses(id),
  FOREIGN KEY (to_status_id) REFERENCES statuses(id)
);

CREATE INDEX idx_ticket_flow_history_ticket_id ON ticket_flow_history(ticket_id);
CREATE INDEX idx_ticket_flow_history_created_at ON ticket_flow_history(created_at DESC);
```

### 7. Workspace Ticket Sequences
```sql
CREATE TABLE IF NOT EXISTS workspace_ticket_sequences (
  workspace_id TEXT PRIMARY KEY,
  next_ticket_number INTEGER DEFAULT 1,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
```

---

## TypeScript Schema

```typescript
// Status with default flow properties (global defaults)
export interface Status {
  id: string
  name: string
  color: string
  description: string | null
  workspace_id: string
  priority: number // default order
  agent_id: string | null // default agent
  on_failed_goto: string | null // default fail goto
  is_flow_included: boolean // default inclusion
  ask_approve_to_continue: boolean // default approval
  instructions_override: string | null
  is_system_status: boolean
  created_at: string
  updated_at: string
}

// Ticket-specific flow configuration
export interface TicketFlowConfig {
  id: string
  ticket_id: string
  status_id: string
  flow_order: number // order in this ticket's flow
  agent_id: string | null // override agent
  on_failed_goto: string | null // override fail goto
  ask_approve_to_continue: boolean // override approval
  instructions_override: string | null // override instructions
  is_included: boolean // whether in this ticket's flow
  created_at: string
  updated_at: string
}

// Combined status with config for API responses
export interface TicketFlowStatus {
  status: Status // the base status
  config: TicketFlowConfig // ticket-specific override
}

// Input for creating/updating ticket flow config
export interface TicketFlowConfigInput {
  status_id: string
  flow_order: number
  agent_id?: string | null
  on_failed_goto?: string | null
  ask_approve_to_continue?: boolean
  instructions_override?: string | null
  is_included?: boolean
}
```

---

## Ticket Creation Flow UI

### Modal Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    Create New Ticket                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Title: [_____________________________________________]         │
│                                                                  │
│  Description:                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                        Markdown Editor                      │  │
│  │                                                           │  │
│  │  [**B**] [*I*] [Link] [Code] [...]                        │  │
│  │                                                           │  │
│  │  Write ticket description in markdown...                  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ☑ Enable Flow for this ticket                                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Flow Configuration (when enabled)                         │  │
│  │                                                           │  │
│  │  Drag and drop to reorder. Click to edit properties.       │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ ⋮⋮  📝 Todo                                          │  │  │
│  │  │     Agent: [Researcher ▼]                           │  │  │
│  │  │     On Fail: [──────── ▼]                           │  │  │
│  │  │     Approve: ☐                                      │  │  │
│  │  ├─────────────────────────────────────────────────────┤  │  │
│  │  │ ⋮⋮  🔍 Research                                      │  │  │
│  │  │     Agent: [Analyst ▼]                              │  │  │
│  │  │     On Fail: [Todo ▼]                               │  │  │
│  │  │     Approve: ☐                                      │  │  │
│  │  ├─────────────────────────────────────────────────────┤  │  │
│  │  │ ⋮⋮  💻 Development                                   │  │  │
│  │  │     Agent: [Developer ▼]                            │  │  │
│  │  │     On Fail: [Research ▼]                           │  │  │
│  │  │     Approve: ☑                                      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  [+ Add Status to Flow]                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Assignee: [@user ▼]                                            │
│                                                                  │
│  [Cancel]                                          [Create Ticket]│
└─────────────────────────────────────────────────────────────────┘
```

### Flow Configuration Behavior

1. **When flow toggle is OFF**: Hide the flow configuration section entirely
2. **When flow toggle is ON**: 
   - Show flow configuration section
   - Default to workspace's statuses with their default configurations
   - Allow drag-and-drop reordering
   - Allow inline editing of:
     - Agent assignment
     - On failed goto
     - Ask approve to continue
   - Allow adding/removing statuses from this ticket's flow

---

## API Routes

### Ticket Flow Config Routes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/tickets/{ticketId}/flow-config` | GET | Get ticket's flow configuration |
| `/api/tickets/{ticketId}/flow-config` | PUT | Update ticket's flow configuration |
| `/api/tickets/{ticketId}/flow-config/initialize` | POST | Initialize flow from workspace defaults |

### Initialize Flow Config Example
```json
// POST /api/tickets/{ticketId}/flow-config/initialize
// Creates ticket_flow_configs from workspace statuses with defaults

// Response - returns the initialized flow configs
[
  {
    "id": "config_1",
    "ticket_id": "ticket_123",
    "status_id": "status_todo",
    "status": {
      "id": "status_todo",
      "name": "Todo",
      "color": "#6B7280"
    },
    "flow_order": 0,
    "agent_id": "agent_researcher",
    "on_failed_goto": null,
    "ask_approve_to_continue": false,
    "is_included": true
  },
  {
    "id": "config_2",
    "ticket_id": "ticket_123",
    "status_id": "status_research",
    "status": { "id": "status_research", "name": "Research", "color": "#3B82F6" },
    "flow_order": 1,
    "agent_id": "agent_analyst",
    "on_failed_goto": "status_todo",
    "ask_approve_to_continue": false,
    "is_included": true
  }
]
```

---

## Implementation Flow

1. **User creates ticket with flow enabled**
   - After ticket creation, initialize flow configs from workspace defaults
   - User can customize the flow in the modal before saving

2. **User can edit flow config later**
   - Open ticket detail modal
   - Flow configuration section is editable
   - Save changes updates `ticket_flow_configs` table

3. **Flow processor uses ticket-specific config**
   - When advancing flow, look at `ticket_flow_configs`
   - Use `flow_order` to determine next status
   - Use `on_failed_goto` from config (not status default)
   - Use `agent_id` from config (not status default)

---

## Status Flow Builder Component

```typescript
// components/tickets/status-flow-builder.tsx

interface StatusFlowBuilderProps {
  ticketId?: string // if editing existing ticket
  workspaceId: string
  initialConfigs?: TicketFlowConfigInput[]
  onChange: (configs: TicketFlowConfigInput[]) => void
  disabled?: boolean
}

// Features:
// - Lists all workspace statuses as draggable items
// - Shows inline editors for each property
// - Drag handle for reordering
// - Remove button for each status
// - Add status dropdown (statuses not in current flow)
```

---

## Database Access Layer

```typescript
// lib/db/ticket-flow-configs.ts

// Initialize flow configs from workspace defaults
export async function initializeTicketFlowConfigs(
  db: Database,
  ticketId: string,
  workspaceId: string
): Promise<TicketFlowConfig[]>

// Get ticket's flow configs (ordered)
export async function getTicketFlowConfigs(
  db: Database,
  ticketId: string
): Promise<TicketFlowConfig[]>

// Get ticket's flow configs with status details
export async function getTicketFlowWithStatuses(
  db: Database,
  ticketId: string
): Promise<TicketFlowStatus[]>

// Update ticket's flow configs
export async function updateTicketFlowConfigs(
  db: Database,
  ticketId: string,
  configs: TicketFlowConfigInput[]
): Promise<void>

// Get next status in flow
export async function getNextFlowStatus(
  db: Database,
  ticketId: string
): Promise<TicketFlowStatus | null>
```

---

## Updated Implementation Steps

1. **Database Migrations**
   - Extend statuses table with default flow columns
   - Create tickets table
   - Create ticket_flow_configs table (NEW)
   - Create ticket_comments table
   - Create ticket_audit_logs table
   - Create ticket_flow_history table
   - Create workspace_ticket_sequences table

2. **Schema Type Definitions**
   - Add interfaces including `TicketFlowConfig`

3. **Database Access Layer**
   - CRUD for tickets
   - CRUD for ticket_flow_configs (NEW)
   - CRUD for comments
   - CRUD for audit logs
   - Flow processing using ticket-specific configs

4. **API Routes**
   - Ticket CRUD
   - Flow config CRUD (NEW)
   - Comment CRUD
   - Flow control

5. **UI Components**
   - Ticket modal with flow builder
   - Status flow builder component (NEW)
   - Inline config editor for each status
   - Markdown editor
   - Audit log panel

6. **Flow Processing Service**
   - Use ticket-specific configs for flow decisions
   - Idle timeout detection
   - Agent session integration
