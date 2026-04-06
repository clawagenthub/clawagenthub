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
