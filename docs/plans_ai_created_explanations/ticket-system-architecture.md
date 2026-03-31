# Ticket System Architecture

## System Overview

```mermaid
graph TB
    subgraph "Frontend - Next.js App"
        Dashboard[Ticket Dashboard]
        Modal[Ticket Modal]
        FlowBuilder[Status Flow Builder]
        AuditPanel[Audit Log Panel]
        Comments[Comments Section]
    end
    
    subgraph "API Routes"
        TicketAPI[/api/tickets/*]
        CommentAPI[/api/ticketcomments/*]
        FlowAPI[/api/ticketflows/*]
        StatusAPI[/api/statuses/*]
    end
    
    subgraph "Database Layer"
        DB[(SQLite Database)]
        Tickets[tickets table]
        Comments[ticket_comments table]
        Audit[ticket_audit_logs table]
        FlowHistory[ticket_flow_history table]
        Statuses[statuses table]
    end
    
    subgraph "Services"
        FlowProcessor[Flow Processor]
        IdleDetector[Idle Timeout Detector]
        AgentIntegrator[Agent Integrator]
    end
    
    subgraph "External - OpenClaw Gateway"
        Gateway[WebSocket Gateway]
        Agents[AI Agents]
    end
    
    Dashboard --> TicketAPI
    Modal --> TicketAPI
    Modal --> CommentAPI
    FlowBuilder --> StatusAPI
    AuditPanel --> TicketAPI
    Comments --> CommentAPI
    
    TicketAPI --> DB
    CommentAPI --> DB
    FlowAPI --> DB
    StatusAPI --> DB
    
    FlowProcessor --> FlowAPI
    IdleDetector --> FlowProcessor
    FlowProcessor --> AgentIntegrator
    AgentIntegrator --> Gateway
    Gateway --> Agents
```

## Flow State Machine

```mermaid
stateDiagram-v2
    direction LR
    
    [*] --> NotInFlow: Created (no flow)
    [*] --> Todo: Created (flow enabled)
    
    Todo --> Research: Agent completes\n(timeout or signal)
    Research --> Development: Agent completes
    Development --> Testing: Agent completes
    Testing --> CodeReview: Agent completes
    CodeReview --> Finished: Agent completes
    
    Todo --> NotInFlow: onFailedGoto
    Research --> Todo: onFailedGoto
    Development --> Research: onFailedGoto
    Testing --> Development: onFailedGoto
    CodeReview --> Testing: onFailedGoto
    
    Testing --> CodeReview: askApproveToContinue\n+ user approval
    
    note right of Todo
        priority: 0
        agent: researcher
        isFlowIncluded: true
    end note
    
    note right of Research
        priority: 1
        agent: researcher
        onFailedGoto: Todo
    end note
```

## Database Schema Relationships

```mermaid
erDiagram
    WORKSPACES ||--o{ TICKETS : has
    WORKSPACES ||--o{ STATUSES : has
    WORKSPACES ||--|| WORKSPACE_TICKET_SEQUENCES : has
    
    TICKETS ||--o{ TICKET_COMMENTS : has
    TICKETS ||--o{ TICKET_AUDIT_LOGS : has
    TICKETS ||--o{ TICKET_FLOW_HISTORY : has
    TICKETS }o--|| STATUSES : has_current
    TICKETS }o--o| USERS : created_by
    TICKETS }o--o| USERS : assigned_to
    
    STATUSES }o--o| USERS : agent_id
    STATUSES }o--o| STATUSES : on_failed_goto
    
    TICKET_COMMENTS }o--o| USERS : created_by
    
    TICKET_AUDIT_LOGS }o--o| USERS : actor_id
    
    TICKET_FLOW_HISTORY }o--o| STATUSES : from_status
    TICKET_FLOW_HISTORY }o--|| STATUSES : to_status
    TICKET_FLOW_HISTORY }o--o| CHAT_SESSIONS : session_id
    
    WORKSPACES {
        string id PK
        string name
        string owner_id
    }
    
    TICKETS {
        string id PK
        string workspace_id FK
        number ticket_number
        string title
        text description
        string status_id FK
        string created_by FK
        string assigned_to FK
        boolean flow_enabled
        string current_agent_session_id
        datetime last_flow_check_at
        datetime completed_at
    }
    
    STATUSES {
        string id PK
        string workspace_id FK
        string name
        string color
        number priority
        string agent_id FK
        string on_failed_goto FK
        boolean is_flow_included
        boolean ask_approve_to_continue
        text instructions_override
        boolean is_system_status
    }
    
    TICKET_COMMENTS {
        string id PK
        string ticket_id FK
        text content
        string created_by FK
        boolean is_agent_completion_signal
    }
    
    TICKET_AUDIT_LOGS {
        string id PK
        string ticket_id FK
        string event_type
        string actor_id FK
        string actor_type
        text old_value
        text new_value
        text metadata
    }
    
    TICKET_FLOW_HISTORY {
        string id PK
        string ticket_id FK
        string from_status_id FK
        string to_status_id FK
        string agent_id FK
        string session_id FK
        string flow_result
        text failure_reason
    }
```

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      Ticket Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────────────────────────────┐ │
│  │   Filters   │  │           Ticket List                 │ │
│  │  - Status   │  │  ┌─────────────────────────────────┐ │ │
│  │  - Assignee │  │  │ 🎫 TICKET-1: Fix login bug      │ │ │
│  │  - Search   │  │  │    Status: Todo | Assigned: @dev │ │ │
│  └─────────────┘  │  └─────────────────────────────────┘ │ │
│                   │  ┌─────────────────────────────────┐ │ │
│                   │  │ 🎫 TICKET-2: Add dark mode      │ │ │
│  ┌─────────────┐  │  │    Status: In Progress          │ │ │
│  │   [+ New]   │  │  └─────────────────────────────────┘ │ │
│  └─────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Ticket Modal (80vh × 80vw)               │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Title: [Implement user authentication              ] │  │
│  │                                                       │  │
│  │  Description:                                         │  │
│  │  ┌─────────────────┬──────────────────────────────┐ │  │
│  │  │ Markdown Editor │         Preview               │ │  │
│  │  │ [**Bold**]      │  **Bold**                     │ │  │
│  │  │ [*Italic*]      │  *Italic*                     │ │  │
│  │  │                 │                               │ │  │
│  │  │ Create auth     │  Create auth system with      │ │  │
│  │  │ system with...  │  JWT tokens...                │ │  │
│  │  └─────────────────┴──────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ☑ Enable Flow                                       │  │
│  │  Status: [Todo ▼]    Assignee: [@user ▼]            │  │
│  │                                                       │  │
│  │  [Cancel]                              [Save Ticket] │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Status Flow Builder                        │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Status Configuration                                 │  │
│  │                                                       │  │
│  │  ┌───────────────────────────────────────────────┐  │  │
│  │  │ ⋮⋮  📝 Todo                    Agent: Researcher│  │  │
│  │  │    Flow: ✓ | Approve: ✗ | Fail goto: ─       │  │  │
│  │  ├───────────────────────────────────────────────┤  │  │
│  │  │ ⋮⋮  🔍 Research                Agent: Analyst  │  │  │
│  │  │    Flow: ✓ | Approve: ✗ | Fail goto: Todo    │  │  │
│  │  ├───────────────────────────────────────────────┤  │  │
│  │  │ ⋮⋮  💻 Development            Agent: Developer │  │  │
│  │  │    Flow: ✓ | Approve: ✗ | Fail goto: Research│  │  │
│  │  ├───────────────────────────────────────────────┤  │  │
│  │  │ ⋮⋮  🧪 Testing                 Agent: Tester   │  │  │
│  │  │    Flow: ✓ | Approve: ✓ | Fail goto: Dev     │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  [+ Add Status]                          [Save Config]│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Audit Log Panel                          │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │  📋 Activity Timeline                                 │  │
│  │                                                       │  │
│  │  🤖 @researcher-bot moved this to Research           │  │
│  │     2 hours ago                                       │  │
│  │                                                       │  │
│  │  ➡️ Flow transition: Todo → Research                 │  │
│  │     2 hours ago                                       │  │
│  │                                                       │  │
│  │  💬 @john added a comment                            │  │
│  │     "Please check the API docs first..."             │  │
│  │     3 hours ago                                       │  │
│  │                                                       │  │
│  │  📝 @jane edited the ticket                          │  │
│  │     Changed title from "Fix auth" to "Implement..."  │  │
│  │     4 hours ago                                       │  │
│  │                                                       │  │
│  │  🎫 @jane created this ticket                        │  │
│  │     5 hours ago                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Flow Processing Logic

```mermaid
flowchart TD
    Start[Start Flow Check] --> CheckSession{Has active session?}
    
    CheckSession -->|No| FindNext[Find next status in flow]
    CheckSession -->|Yes| CheckIdle{Session idle > 2min?}
    
    CheckIdle -->|No| ScheduleNext[Schedule next check]
    CheckIdle -->|Yes| GetAgentComment{Agent added completion signal?}
    
    GetAgentComment -->|Yes| Success[Flow step completed]
    GetAgentComment -->|No| Idle[Agent idle timeout]
    
    Success --> FindNext
    Idle --> FindNext
    
    FindNext --> CheckNext{Has next status?}
    
    CheckNext -->|No| MarkFinished[Mark ticket as finished]
    CheckNext -->|Yes| CheckProps{Check status properties}
    
    CheckProps -->|askApproveToContinue| WaitForApproval[Wait for user approval]
    CheckProps -->|Normal| CreateSession[Create agent session]
    
    WaitForApproval -->|Approved| CreateSession
    WaitForApproval -->|Rejected| Skip[Skip to next status]
    
    CreateSession --> UpdateTicket[Update ticket status]
    UpdateTicket --> LogFlow[Log flow transition]
    LogFlow --> CreateChatSession[Create chat session with agent]
    CreateChatSession --> NotifyAgent[Send objective to agent]
    NotifyAgent --> ScheduleNext
    
    MarkFinished --> LogComplete[Log completion]
    LogComplete --> End[End]
    
    Skip --> FindNext
    ScheduleNext --> End
```

## API Request/Response Examples

### Create Ticket
```json
// POST /api/workspaces/{workspaceId}/tickets
{
  "title": "Implement user authentication",
  "description": "# Overview\nCreate JWT-based auth system...",
  "status_id": "status_todo_123",
  "flow_enabled": true,
  "assigned_to": "user_456"
}

// Response
{
  "id": "ticket_789",
  "ticket_number": 1,
  "workspace_id": "workspace_123",
  "title": "Implement user authentication",
  "description": "# Overview\n...",
  "status": {
    "id": "status_todo_123",
    "name": "Todo",
    "color": "#6B7280"
  },
  "created_by": {
    "id": "user_123",
    "email": "user@example.com"
  },
  "flow_enabled": true,
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Add Comment
```json
// POST /api/tickets/{ticketId}/comments
{
  "content": "I've started researching the best approach...",
  "is_agent_completion_signal": false
}

// Response
{
  "id": "comment_456",
  "ticket_id": "ticket_789",
  "content": "I've started researching...",
  "created_by": {
    "id": "user_123",
    "email": "user@example.com"
  },
  "created_at": "2024-01-15T11:00:00Z"
}
```

### Update Flow Status
```json
// PATCH /api/tickets/{ticketId}/flow
{
  "result": "finished",
  "notes": "Research completed successfully"
}

// Response
{
  "success": true,
  "ticket_id": "ticket_789",
  "old_status": { "id": "status_todo", "name": "Todo" },
  "new_status": { "id": "status_research", "name": "Research" },
  "flow_history": {
    "id": "flow_123",
    "from_status": "Todo",
    "to_status": "Research",
    "result": "success"
  }
}
```

### Error Response (401 - No Agent)
```json
// Response when agent not configured
{
  "error": "no_agent_configured",
  "message": "No agent is configured for the 'Research' status",
  "status_id": "status_research_123"
}
```

## Idle Timeout Detection

```javascript
// Pseudo-code for idle detector
async function detectIdleTickets() {
  const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
  
  // Get tickets with active agent sessions
  const activeTickets = await db.tickets.find({
    where: {
      flow_enabled: true,
      current_agent_session_id: { ne: null }
    }
  });
  
  for (const ticket of activeTickets) {
    // Check session last activity
    const session = await db.chatSessions.findOne({
      where: { id: ticket.current_agent_session_id }
    });
    
    if (session && new Date(session.last_activity_at) < threshold) {
      // Session is idle, advance flow
      await flowProcessor.advanceTicket(ticket.id, 'idle_timeout');
    }
  }
}

// Run every 30 seconds
setInterval(detectIdleTickets, 30000);
```
