<img width="1024" height="1024" alt="Gemini_Generated_Image_sabq7qsabq7qsabq (1)" src="https://github.com/user-attachments/assets/84c4ff27-312f-4b54-af3b-01b48f0d1b52" />

# ClawAgentHub

Jira/Trello-style multi-agent management dashboard for OpenClaw.
Build and run ticket flows across workspaces, statuses, skills, and connected gateways.

## Summary of Project

ClawAgentHub is a workspace-first agent orchestration UI where teams can:

- manage multiple isolated workspaces
- create and track tickets in board-style workflows
- run manual or automatic flow transitions between statuses
- attach skills to statuses and let agents execute stage-by-stage

## Project Image

<img width="1510" height="862" alt="ClawAgentHub Dashboard" src="https://github.com/user-attachments/assets/4823084a-fb13-48b7-94a2-d8c55fa54ed5" />

## Photos of Project

### Board / Ticket Views

<img width="1510" height="871" alt="Board View" src="https://github.com/user-attachments/assets/45a17e97-ab44-4d4c-a75a-0e295ae907b4" />
<img width="1510" height="871" alt="Edit Ticket View" src="https://github.com/user-attachments/assets/d3540cd9-947a-4b55-89de-f6c83321c189" />

### Operations / Config Views

<img width="1510" height="871" alt="Chat View" src="https://github.com/user-attachments/assets/88d9d54a-ddde-4ea1-94be-ce9084e5e5c1" />
<img width="1510" height="871" alt="Gateways View" src="https://github.com/user-attachments/assets/36cbca3a-811d-4bb2-b72d-cc143205845c" />
<img width="1510" height="871" alt="Statuses View" src="https://github.com/user-attachments/assets/62ca751d-e6b3-4344-9640-3abf85c1ae57" />
<img width="1510" height="871" alt="Statuses Edit View" src="https://github.com/user-attachments/assets/22a26367-fd75-4880-b638-b0bcadb618a9" />
<img width="1510" height="871" alt="Settings View" src="https://github.com/user-attachments/assets/ee56a45d-4947-422d-88d2-e6eb13350b20" />

<details>
<summary><strong>How to Install</strong></summary>

### 1) Installation

```bash
npm install
cp .env.example .env
npm run db:init
npm run db:migrate
npm run db:seed
npm run dev
```

Default URL:

```text
http://127.0.0.1:7777
```

### 2) OpenClaw config

In your OpenClaw config, enable local control-ui compatibility:

```json
"controlUi": {
  "dangerouslyAllowHostHeaderOriginFallback": true
}
```

And export:

```bash
NO_PROXY=localhost,127.0.0.1
no_proxy=localhost,127.0.0.1
OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1
```

### 3) Warning about vibe coding

This project was built with vibe coding workflows.
Security hardening is required before production:

- audit secrets, tokens, and session config
- audit API authorization and workspace isolation
- audit deployment/networking settings

</details>

<details>
<summary><strong>Quickstart</strong></summary>

### Statuses used in this project (from current DB)

Use this format as dashboard reference: **status name → dropdown → priority / on_failed_goto / default flow / description context**.

<details>
<summary><strong>To Do</strong></summary>

- priority: `1`
- on_failed_goto: `null`
- is_flow_included (default flow): `1`
- ask_approve_to_continue: `0`
- description context: `Items that need to be done`

</details>

<details>
<summary><strong>Resarch</strong></summary>

- priority: `2`
- on_failed_goto: `null`
- is_flow_included (default flow): `1`
- ask_approve_to_continue: `0`
- description context: XML `research_agent_prompt` (deep research plan/retrieve/synthesize workflow)

</details>

<details>
<summary><strong>Architect</strong></summary>

- priority: `3`
- on_failed_goto: `null`
- is_flow_included (default flow): `1`
- ask_approve_to_continue: `0`
- description context: XML `system_designer_prompt` (architecture + file structure blueprint)

</details>

<details>
<summary><strong>Marketing</strong></summary>

- priority: `4`
- on_failed_goto: `null`
- is_flow_included (default flow): `0`
- ask_approve_to_continue: `0`
- description context: XML `gtm_strategist_prompt` (GTM comparison + budget/performance strategy)

</details>

<details>
<summary><strong>In Progress (Implementation)</strong></summary>

- priority: `5`
- on_failed_goto: `Failed`
- is_flow_included (default flow): `1`
- ask_approve_to_continue: `0`
- description context: XML `implementation_agent_prompt` (direct implementation workflow)

</details>

<details>
<summary><strong>Testing</strong></summary>

- priority: `6`
- on_failed_goto: `Failed`
- is_flow_included (default flow): `1`
- ask_approve_to_continue: `0`
- description context: XML `qa_engineer_prompt` (QA framework + UAT + automation)

</details>

<details>
<summary><strong>Failed</strong></summary>

- priority: `7`
- on_failed_goto: `null`
- is_flow_included (default flow): `0`
- ask_approve_to_continue: `0`
- description context: `Failed task should master look at it.`

</details>

<details>
<summary><strong>Done</strong></summary>

- priority: `8`
- on_failed_goto: `null`
- is_flow_included (default flow): `1`
- ask_approve_to_continue: `0`
- description context: `Completed items`

</details>

<details>
<summary><strong>Closed</strong></summary>

- priority: `10`
- on_failed_goto: `null`
- is_flow_included (default flow): `0`
- ask_approve_to_continue: `0`
- description context: `Finished closed old tickets.`

</details>

<details>
<summary><strong>Test Status</strong></summary>

- priority: `999`
- on_failed_goto: `null`
- is_flow_included (default flow): `0`
- ask_approve_to_continue: `0`
- description context: `null` (empty)

</details>

### Pull statuses from API (session scoped)

Endpoint in [`app/api/[sessionId]/statuses/route.ts`](Desktop/projects/clawagenthub/app/api/[sessionId]/statuses/route.ts):

```bash
GET /api/{sessionId}/statuses
```

### Ticket flow mode you can use

- `manual`
- `automatic`

Flow runtime states include values like `stopped`, `flowing`, `waiting`, `waiting_to_flow`, `failed`, `completed` from [`lib/db/migrations/033_add_sub_ticket_columns.sql`](Desktop/projects/clawagenthub/lib/db/migrations/033_add_sub_ticket_columns.sql).

### Skills you should use

- list available skills: `GET /api/{sessionId}/skills`
- attach skills to status: `PUT /api/{sessionId}/statuses/{id}/skills`
- verify status skills: `GET /api/{sessionId}/statuses/{id}/skills`

These routes are implemented under [`app/api/[sessionId]/statuses/[id]/skills/route.ts`](Desktop/projects/clawagenthub/app/api/[sessionId]/statuses/[id]/skills/route.ts).

</details>

<details>
<summary><strong>Tips</strong></summary>

1. If you caused a problem, ask AI immediately with the exact error + action history.
2. Add OpenClaw context-management plugin/workflow to keep prompts and ticket context stable across long runs.
3. Use browser automation for repetitive UI flows (status edits, ticket updates, regression checks) — very effective for this dashboard.
4. Add Grafana for backend observability and AI test feedback loops (request latency, flow failures, gateway errors, retry behavior).
5. Keep one workspace for experiments and one workspace for stable production-like testing.

</details>

<details>
<summary><strong>Knowledges</strong></summary>

### What is Flow?

Flow is step-by-step ticket execution where each status can map to an agent + skill set.

### What are Workspaces?

Workspaces are isolation boundaries. Each workspace has its own statuses, tickets, gateway connections, and member context.

### User management (next era)

Current architecture already centers around session + workspace membership.
Next evolution can expand role policies, workspace governance, and deeper user lifecycle controls.

</details>

## License

MIT
