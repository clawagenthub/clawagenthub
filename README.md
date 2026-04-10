<img width="1024" height="1024" alt="Gemini_Generated_Image_sabq7qsabq7qsabq (1)" src="https://github.com/user-attachments/assets/84c4ff27-312f-4b54-af3b-01b48f0d1b52" />

# ClawAgentHub

ClawAgentHub is a multi-agent workspace dashboard for OpenClaw, designed for Jira-style multitasking with multiple agents working in parallel.

## Important Note

This project was built using vibe coding workflows.
Because of that, security issues may still exist.
Always review code, environment values, authentication rules, and deployment settings before production use.

## What is ClawAgentHub

ClawAgentHub connects to OpenClaw gateways and helps teams:

- manage multiple workspaces
- create and track tickets
- run flow-based ticket automation with agents
- manage statuses that drive flow transitions

## Status ID Mappings

| status_id | Name        | Description                           |
| --------- | ----------- | ------------------------------------- |
| 1         | Open        | Ticket is created and awaiting action |
| 2         | In Progress | Ticket is being worked on             |
| 3         | Waiting     | Ticket is waiting on dependency       |
| 4         | Finished    | All flow steps completed              |

Note: `status_id` values are workspace-specific. The above is the default mapping
created during initial setup. Verify with `GET /api/statuses`.

## Flow Configuration System

### Overview

The flow configuration system allows tickets to progress through a series of defined steps, with each step handled by a specific agent. The system supports both automatic and manual flow modes.

### Flow Configuration Variables

When a ticket is processed through flow, the following variables are available to agents:

#### $flowConfig (Array)

Defines the sequence of flow steps with failure handling:

```typescript
$flowConfig = [
  {
    statusId: string, // Status ID for this step
    statusName: string, // Human-readable status name
    flowOrder: number, // Sequence order (1, 2, 3...)
    agentId: string, // Agent responsible for this step
    onFailedGoto: string | null, // Status to goto on failure, null=stop flow
    askApproveToContinue: boolean, // Pause for manual approval
  },
]
```

When an agent completes their task, they call the `/next` API endpoint to advance the flow to the next stage. The `/next` endpoint handles flow configuration lookup, status transitions, task sending to the next agent, and automatic triggering.



### Status ID Mappings

#### Flow-Specific Statuses

| status_id | Name     | Description         | Notes                 |
| --------- | -------- | ------------------- | --------------------- |
| 1         | waiting  | Initial flow state  | Set when flow starts  |
| 2         | finished | Flow step completed | Advances to next step |

### API Authentication

Ticket operations support two authentication methods:

1. **Session Token (Cookie):**

   ```
   Cookie: session_token=<token>
   ```

2. **Bearer Token (OpenClaw Gateway):**
   ```
   Authorization: Bearer <token>
   ```

### Session-Token Based API Endpoints

> ⚠️ **Migration Notice**: API paths have been updated from flat paths to **session-scoped paths**. Old endpoints are deprecated. See [Migration Guide](#migration-guide) below.

The following endpoints use session-token based routing:

```
POST /api/{sessionId}/tickets/create  - Create a new ticket (CRUD)
GET  /api/{sessionId}/tickets       - List tickets
GET  /api/{sessionId}/tickets/:id    - Get ticket details
PATCH /api/{sessionId}/tickets/:id   - Update ticket fields
DELETE /api/{sessionId}/tickets/:id  - Delete a ticket
```

### Session-Scoped API Endpoints

All ticket operations now use session-scoped paths:

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Tickets** | `GET /api/{sessionId}/tickets` | List all tickets |
| **Tickets** | `POST /api/{sessionId}/tickets` | Create a ticket |
| **Tickets** | `GET /api/{sessionId}/tickets/:id` | Get ticket details |
| **Tickets** | `PATCH /api/{sessionId}/tickets/:id` | Update a ticket |
| **Tickets** | `DELETE /api/{sessionId}/tickets/:id` | Delete a ticket |
| **Flow View** | `GET /api/{sessionId}/tickets/:id/flow/view` | Get flow configuration and history |
| **Flow Callbacks** | `POST /api/{sessionId}/tickets/:id/next` | Advance to next flow stage |
| **Flow Callbacks** | `POST /api/{sessionId}/tickets/:id/failed` | Mark flow step failed |
| **Flow Callbacks** | `POST /api/{sessionId}/tickets/:id/pause` | Pause flow |
| **Flow Callbacks** | `POST /api/{sessionId}/tickets/:id/restart` | Restart flow from beginning |
| **Comments** | `GET /api/{sessionId}/tickets/:id/comments` | Get ticket comments |
| **Comments** | `POST /api/{sessionId}/tickets/:id/comments` | Add a comment |
| **Gateways** | `GET /api/{sessionId}/gateways` | List gateways |
| **Gateways** | `POST /api/{sessionId}/gateways/:id/connect` | Connect gateway |
| **Gateways** | `GET /api/{sessionId}/gateways/check-paired` | Check pairing status |
| **Statuses** | `GET /api/{sessionId}/statuses` | List statuses |
| **Skills** | `GET /api/{sessionId}/skills` | List skills |
| **Workspaces** | `GET /api/{sessionId}/workspaces` | List workspaces |
| **Projects** | `GET /api/{sessionId}/projects` | List projects |
| **Chat** | `GET /api/{sessionId}/chat` | Chat history |
| **Cron** | `GET /api/{sessionId}/cron` | List cron jobs |
| **Agent Tools** | `GET /api/{sessionId}/agent-tools` | List agent tools |
| **Attachments** | `GET /api/{sessionId}/attachments` | List attachments |
| **Logs** | `GET /api/{sessionId}/logs` | Get logs |
| **User** | `GET /api/{sessionId}/user` | Get user info |

### Migration Guide

#### Old (Deprecated) → New (Session-Scoped) Endpoints

| Category | Old Path (Deprecated) | New Path |
|----------|------------------------|----------|
| **Tickets CRUD** | `/api/tickets` | `/api/{sessionId}/tickets` |
| **Ticket Details** | `/api/tickets/{id}` | `/api/{sessionId}/tickets/{id}` |
| **Flow Next** | `/api/tickets/{id}_{token}/next` | `/api/{sessionId}/tickets/{id}/next` |
| **Flow Failed** | `/api/tickets/{id}_{token}/failed` | `/api/{sessionId}/tickets/{id}/failed` |
| **Flow Pause** | `/api/tickets/{id}_{token}/pause` | `/api/{sessionId}/tickets/{id}/pause` |
| **Flow Restart** | `/api/tickets/{id}_{token}/restart` | `/api/{sessionId}/tickets/{id}/restart` |
| **Comments** | `/api/tickets/{id}/comments` | `/api/{sessionId}/tickets/{id}/comments` |
| **Gateway Pairing Status** | `/api/gateways/{id}/pairing-status` | **DEPRECATED** → Use `/api/{sessionId}/gateways` |
| **Gateway Pair** | `/api/gateways/pair` | **DEPRECATED** → Use `/api/{sessionId}/gateways/{id}/connect` |
| **Gateway Connect with Token** | `/api/gateways/connect-with-token` | **DEPRECATED** → Use `/api/{sessionId}/gateways/{id}/connect` |

#### Key Changes

1. **Session ID replaces Session Token in URL path**: `{sessionId}` is now used directly in the path instead of embedding the token in the URL
2. **Unified structure**: All endpoints follow `/api/{sessionId}/resource` pattern
3. **Authentication**: Session token is passed via `Authorization: Bearer <token>` header, not embedded in URLs
4. **Deprecated endpoints**: Three gateway endpoints are marked deprecated and should not be used

#### Example: Creating a Ticket with Flow (Updated)

```bash
curl -X POST http://127.0.0.1:7777/api/{sessionId}/tickets \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement new feature",
    "description": "Create flow configuration for tickets",
    "statusId": 1,
    "flowEnabled": true,
    "flowMode": "automatic"
  }'
```

#### Example: Advance Flow (Updated)

```bash
curl -X POST http://127.0.0.1:7777/api/{sessionId}/tickets/{ticketId}/next \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Advanced to next stage. Summary: ..."
  }'
```

#### Example: Restart Flow

```bash
curl -X POST http://127.0.0.1:7777/api/{sessionId}/tickets/{ticketId}/restart \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Restarting flow from beginning. Reason: ..."
  }'
```

### Example: User Request Interpretation

When a user says:

> "create for each ticket for every issue with status waiting_flow, with flow mode automatic, with flow config is default flowconfiguration"

The system interprets:

- `$flowMode = "automatic"`
- `$flowConfig = [configured flow steps from default flowconfiguration]`
- Initial status ID = 1 (waiting/initial state)

### Fail-to-Go Behavior

Each flow step can define an `onFailedGoto` property:

- **null**: Flow stops when step fails (terminal failure)
- **statusId string**: Flow redirects to specified status on failure

Example:

```typescript
{
  statusId: "2",
  statusName: "finished",
  flowOrder: 2,
  agentId: "coder",
  onFailedGoto: "1",  // On failure, go back to waiting status
  askApproveToContinue: true
}
```

## Sub-Ticket System

### Overview

ClawAgentHub supports hierarchical tickets with parent-child relationships and flow dependencies.

### Key Concepts

- **Sub-Ticket**: A ticket that belongs to a parent ticket
- **Parent Ticket**: A ticket that may have one or more sub-tickets
- **Flow Dependency**: A ticket can wait for another ticket to be finished before flowing

### Creating Sub-Tickets

When creating a ticket, set the `isSubTicket` flag and provide `parentTicketId`:

```bash
curl -X POST http://127.0.0.1:7777/api/tickets \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sub Task",
    "description": "This is a sub-task",
    "statusId": 1,
    "isSubTicket": true,
    "parentTicketId": "parent-ticket-uuid-here"
  }'
```

### Setting Flow Dependencies

To make a ticket wait for another ticket to finish:

```bash
curl -X PATCH http://127.0.0.1:7777/api/tickets/ticket-uuid \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "waitingFinishedTicketId": "ticket-uuid-to-wait-for"
  }'
```

### Auto-Finish Logic

When all flow steps in a ticket's flow configuration are completed, the system automatically updates the ticket status to "Finished" (status_id = 4).

**Variant A (Trigger):** Immediate update via SQLite trigger
**Variant B (Service):** Controlled update via FlowAutoFinishService

### Database Schema Changes

The `tickets` table has three new columns:

| Column                       | Type    | Description                             |
| ---------------------------- | ------- | --------------------------------------- |
| `is_sub_ticket`              | INTEGER | 1 if this is a sub-ticket, 0 otherwise  |
| `parent_ticket_id`           | TEXT    | Foreign key to parent ticket (nullable) |
| `waiting_finished_ticket_id` | TEXT    | Ticket ID this must wait for (nullable) |

### API: GET /api/tickets/:id

Response includes sub-ticket fields:

```json
{
  "id": "ticket-uuid",
  "title": "Task Title",
  "is_sub_ticket": true,
  "parent_ticket_id": "parent-uuid",
  "waiting_finished_ticket_id": null,
  ...
}
```

## Core Concepts

### Flow

Flow means step-by-step execution for a ticket.
When flow is enabled on a ticket in the dashboard, OpenClaw agents process that ticket through the configured status/step sequence.

### Statuses

Statuses define how flow progresses from one step to the next.
You can configure status behavior and optional default flow config per status.

### Workspaces

Each workspace is isolated.
A workspace can have its own gateways, settings, statuses, and ticket flows.

## UI Views

Dashboard view
<img width="1510" height="862" alt="image" src="https://github.com/user-attachments/assets/4823084a-fb13-48b7-94a2-d8c55fa54ed5" />
<img width="1510" height="871" alt="Image" src="https://github.com/user-attachments/assets/45a17e97-ab44-4d4c-a75a-0e295ae907b4" />

Edit ticket view
<img width="1510" height="871" alt="Image" src="https://github.com/user-attachments/assets/d3540cd9-947a-4b55-89de-f6c83321c189" />

Chat view
<img width="1510" height="871" alt="Image" src="https://github.com/user-attachments/assets/88d9d54a-ddde-4ea1-94be-ce9084e5e5c1" />

Gateways view
<img width="1510" height="871" alt="Image" src="https://github.com/user-attachments/assets/36cbca3a-811d-4bb2-b72d-cc143205845c" />

Statuses view
<img width="1510" height="871" alt="Image" src="https://github.com/user-attachments/assets/62ca751d-e6b3-4344-9640-3abf85c1ae57" />

Statuses edit view
<img width="1510" height="871" alt="Image" src="https://github.com/user-attachments/assets/22a26367-fd75-4880-b638-b0bcadb618a9" />

Settings view
<img width="1510" height="871" alt="Image" src="https://github.com/user-attachments/assets/ee56a45d-4947-422d-88d2-e6eb13350b20" />

## Prerequisites

- Node.js 18+
- npm
- SQLite3 CLI installed on your machine

### Install SQLite3

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y sqlite3
```

macOS (Homebrew):

```bash
brew install sqlite
```

Windows (winget):

```bash
winget install SQLite.SQLite
```

## Setup Project

```bash
npm install
cp .env.example .env
```

Initialize database schema:

```bash
npm run db:init
```

Run migrations:

```bash
npm run db:migrate
```

Seed data:

```bash
npm run db:seed
```

Check DB health:

```bash
npm run db:check
```

## Run Locally (Localhost Only)

Development server (bind only to localhost):

```bash
npx vinext dev --host 127.0.0.1 --port 7777
```

Open:

```text
http://127.0.0.1:7777
```

## Build and Start

Build:

```bash
npm run build
```

Start production server on localhost only:

```bash
npx vinext start --host 127.0.0.1 --port 7777
```

## Useful Commands

```bash
# Dev
npm run dev

# Lint and format
npm run lint
npm run format

# Database
npm run db:init
npm run db:migrate
npm run db:seed
npm run db:check
npm run db:reset
```

## Environment Variables

See [`.env.example`](githubprojects/clawhub/.env.example).

- `DATABASE_PATH` path to SQLite DB file
- `SESSION_SECRET` session signing secret
- `SESSION_DURATION` session duration in milliseconds
- `SETUP_TOKEN_DURATION` setup token expiration in milliseconds
- `NODE_ENV` runtime environment

## Agent-Project Communication

Agents can be configured to communicate with the ClawAgentHub project API to perform actions like creating tickets, updating statuses, and managing flows programmatically.

### API Endpoint

The API server runs alongside the dashboard. Default base URL: `http://127.0.0.1:7777/api`

### Required Security Settings for Agents

Agents cannot communicate with the project unless these OpenClaw security settings are configured:

**`openclaw.json` — controlUi section:**

```json
"controlUi": {
  "dangerouslyAllowHostHeaderOriginFallback": true
}
```

**Environment variables:**

```bash
NO_PROXY=localhost,127.0.0.1
no_proxy=localhost,127.0.0.1
OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1
```

These settings allow sandboxed agents to securely connect to local services. Without them, WebSocket connections and API requests from agents to `localhost` will be blocked.

### Authentication

Include the session token in requests:

```bash
Authorization: Bearer <session_token>
```

### Available Endpoints

#### Tickets

- `GET /api/tickets` — List all tickets
- `POST /api/tickets` — Create a ticket
- `GET /api/tickets/:id` — Get ticket details
- `PATCH /api/tickets/:id` — Update a ticket
- `DELETE /api/tickets/:id` — Delete a ticket

#### Statuses

- `GET /api/statuses` — List all statuses
- `POST /api/statuses` — Create a status
- `PATCH /api/statuses/:id` — Update a status
- `DELETE /api/statuses/:id` — Delete a status

#### Flows

- `GET /api/flows` — List all flows
- `POST /api/flows` — Create a flow
- `GET /api/flows/:id` — Get flow details
- `PATCH /api/flows/:id` — Update a flow
- `DELETE /api/flows/:id` — Delete a flow

### Example: Create a Ticket via Agent

Agents can POST to the API using environment variables or configuration:

```bash
curl -X POST http://127.0.0.1:7777/api/tickets \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Agent task",
    "description": "Description from agent",
    "statusId": 1
  }'
```

### Session Token

The session token is established when a user logs in through the dashboard UI. Agents using service accounts should use a dedicated API token configured in the `OPENCLAW_API_TOKEN` environment variable or via the agent's `auth` configuration.

## Troubleshooting

### "control ui requires device identity" Error

If you see this error when trying to connect the Control UI to the OpenClaw Gateway:

**Symptom:**

```
Error: control ui requires device identity (use HTTPS or localhost secure context)
```

**Cause:**
The OpenClaw Gateway requires a secure context (HTTPS) for device identity verification. When running the Control UI on HTTP (like `http://localhost:7777`), the browser blocks access to device identity APIs.

**Solution:**

Disable device identity checks for local development by running:

```bash

openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
```

Then restart the gateway:

```bash
openclaw gateway fix --doctor
```

## License

MIT
