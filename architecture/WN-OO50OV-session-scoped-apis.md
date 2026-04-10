# Architecture: Session-Scoped API Routes Migration

**Ticket:** #1378 "new api styles"  
**Status:** Architect  
**Date:** 2026-04-10  
**Author:** Structura

---

## 🎯 Objective

Migrate ClawAgentHub API routes from flat paths (e.g., `/api/tickets/{id}`) to session-scoped paths (e.g., `/api/{sessionId}/tickets/{id}`) and create a unified `verifySession()` utility for secure ticket flow operations.

---

## 📋 Current State Analysis

### Existing Session Verification Pattern

**Current middleware pattern** (`middleware.ts`):
```typescript
// Extracts sessionToken from cookie
let sessionToken = request.cookies.get('session_token')?.value

// Compound URL pattern for flow callbacks (ticket agents)
const compoundMatch = pathname.match(/\/api\/tickets\/[a-zA-Z0-9_-]+_([a-zA-Z0-9_-]+)\//)
if (compoundMatch) {
  sessionToken = compoundMatch[1]
}
```

**Existing flow action routes** use compound URL pattern:
- `/api/tickets/{ticketId}_{sessionToken}/next`
- `/api/tickets/{ticketId}_{sessionToken}/finished`
- `/api/tickets/{ticketId}_{sessionToken}/failed`
- `/api/tickets/{ticketId}_{sessionToken}/pause`

**Problem:** Cookie-based session verification is fragile and doesn't support gateway token verification natively.

---

## 🏗️ Proposed Architecture

### 1. Session Verification Utility

**File:** `lib/session/verify.ts` (NEW)

```typescript
// lib/session/verify.ts

import { getDatabase } from '@/lib/db/index.js'
import type { Session, User } from '@/lib/db/schema.js'

export interface VerifySessionOptions {
  sessionToken?: string
  gatewayToken?: string
  workspaceId?: string
}

export interface SessionVerificationResult {
  valid: boolean
  userId?: string
  workspaceId?: string
  user?: User
  session?: Session
  error?: string
}

/**
 * Verify session using session token or gateway token
 * Returns verification result with user/workspace context
 */
export function verifySession(options: VerifySessionOptions): SessionVerificationResult {
  const { sessionToken, gatewayToken, workspaceId } = options

  // Must provide at least one token
  if (!sessionToken && !gatewayToken) {
    return { valid: false, error: 'No token provided' }
  }

  const db = getDatabase()

  // 1. Verify session token (from cookie or URL)
  if (sessionToken) {
    const session = db
      .prepare(
        `SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`
      )
      .get(sessionToken) as (Session & { user_id: string }) | undefined

    if (session) {
      const user = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(session.user_id) as User | undefined

      if (user) {
        // If workspaceId specified, verify workspace access
        if (workspaceId && session.current_workspace_id !== workspaceId) {
          return { valid: false, error: 'Workspace mismatch' }
        }

        return {
          valid: true,
          userId: user.id,
          workspaceId: session.current_workspace_id || undefined,
          user,
          session,
        }
      }
    }
  }

  // 2. Verify gateway token (for agent-to-API calls)
  if (gatewayToken) {
    // Gateway tokens are stored in the gateways table
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE auth_token = ?')
      .get(gatewayToken) as { id: string; workspace_id: string; user_id: string | null } | undefined

    if (gateway) {
      // Agents use gateway token - workspace context from gateway
      return {
        valid: true,
        workspaceId: gateway.workspace_id,
        error: gateway.user_id ? undefined : 'Gateway token (no user context)',
      }
    }
  }

  return { valid: false, error: 'Invalid or expired token' }
}

/**
 * Extract token from request (cookie or Authorization header)
 */
export function extractToken(request: Request): { sessionToken?: string; gatewayToken?: string } {
  // Check cookies (via headers for API routes)
  const cookieHeader = request.headers.get('cookie') || ''
  const sessionTokenMatch = cookieHeader.match(/session_token=([^;]+)/)
  const sessionToken = sessionTokenMatch ? sessionTokenMatch[1] : undefined

  // Check Authorization header for gateway token
  const authHeader = request.headers.get('authorization')
  let gatewayToken: string | undefined
  if (authHeader?.startsWith('Bearer ')) {
    gatewayToken = authHeader.slice(7)
  }

  return { sessionToken, gatewayToken }
}
```

**Export from:** `lib/session/index.ts`

---

### 2. Directory Structure Migration

**Before (flat):**
```
app/api/
├── tickets/
│   ├── route.ts                    # GET, POST /api/tickets
│   ├── [id]/
│   │   ├── route.ts               # GET, PATCH, DELETE /api/tickets/{id}
│   │   └── attachments/route.ts   # POST /api/tickets/{id}/attachments
│   └── [ticketId]/
│       ├── comments/route.ts       # GET, POST /api/tickets/{ticketId}/comments
│       ├── finished/route.ts      # POST /api/tickets/{ticketId}/finished
│       ├── next/route.ts          # POST /api/tickets/{ticketId}/next
│       └── flow/route.ts          # GET /api/tickets/{ticketId}/flow
├── gateways/
│   └── route.ts                   # GET, POST /api/gateways
└── ...
```

**After (session-scoped):**
```
app/api/
├── [sessionId]/                    # NEW: session-scoped root
│   ├── tickets/
│   │   ├── route.ts               # GET, POST /api/{sessionId}/tickets
│   │   ├── [id]/
│   │   │   ├── route.ts          # GET, PATCH, DELETE /api/{sessionId}/tickets/{id}
│   │   │   └── attachments/route.ts  # POST /api/{sessionId}/tickets/{id}/attachments
│   │   └── [ticketId]/
│   │       ├── comments/route.ts  # GET, POST /api/{sessionId}/tickets/{ticketId}/comments
│   │       ├── finished/route.ts # POST /api/{sessionId}/tickets/{ticketId}/finished
│   │       ├── next/route.ts     # POST /api/{sessionId}/tickets/{ticketId}/next
│   │       ├── failed/route.ts   # POST /api/{sessionId}/tickets/{ticketId}/failed
│   │       ├── pause/route.ts    # POST /api/{sessionId}/tickets/{ticketId}/pause
│   │       ├── flow/
│   │       │   ├── route.ts      # GET /api/{sessionId}/tickets/{ticketId}/flow
│   │       │   └── view/route.ts # GET /api/{sessionId}/tickets/{ticketId}/flow/view
│   │       └── flow-config/
│   │           ├── route.ts       # GET, PATCH /api/{sessionId}/tickets/{ticketId}/flow-config
│   │           └── initialize/route.ts # POST /api/{sessionId}/tickets/{ticketId}/flow-config/initialize
│   ├── gateways/
│   │   ├── route.ts              # GET, POST /api/{sessionId}/gateways
│   │   ├── [id]/
│   │   │   ├── route.ts         # GET, PUT, DELETE /api/{sessionId}/gateways/{id}
│   │   │   ├── connect/route.ts  # POST /api/{sessionId}/gateways/{id}/connect
│   │   │   ├── health/route.ts   # GET /api/{sessionId}/gateways/{id}/health
│   │   │   └── pairing-status/route.ts  # (deprecated)
│   │   ├── add/route.ts         # POST /api/{sessionId}/gateways/add
│   │   ├── check-paired/route.ts # POST /api/{sessionId}/gateways/check-paired
│   │   └── discover/route.ts    # POST /api/{sessionId}/gateways/discover
│   ├── statuses/
│   │   ├── route.ts             # GET, POST, PUT /api/{sessionId}/statuses
│   │   ├── [id]/
│   │   │   ├── route.ts        # GET, PATCH, DELETE /api/{sessionId}/statuses/{id}
│   │   │   └── skills/route.ts # GET, PUT /api/{sessionId}/statuses/{id}/skills
│   │   └── reorder/route.ts     # POST /api/{sessionId}/statuses/reorder
│   ├── projects/
│   │   ├── route.ts            # GET, POST /api/{sessionId}/projects
│   │   └── [id]/route.ts      # GET, PATCH, DELETE /api/{sessionId}/projects/{id}
│   ├── skills/
│   │   ├── route.ts           # GET, POST /api/{sessionId}/skills
│   │   ├── [skillId]/route.ts # GET, PATCH, DELETE /api/{sessionId}/skills/{skillId}
│   │   └── marketplace/route.ts # GET, POST /api/{sessionId}/skills/marketplace
│   ├── chat/
│   │   ├── sessions/
│   │   │   ├── route.ts        # GET, POST /api/{sessionId}/sessions
│   │   │   └── [id]/
│   │   │       ├── route.ts    # GET, PATCH /api/{sessionId}/sessions/{id}
│   │   │       ├── messages/route.ts  # GET, POST /api/{sessionId}/sessions/{id}/messages
│   │   │       ├── heartbeat/route.ts # POST /api/{sessionId}/sessions/{id}/heartbeat
│   │   │       ├── summarize/route.ts # POST /api/{sessionId}/sessions/{id}/summarize
│   │   │       ├── auto-summarize/route.ts # POST /api/{sessionId}/sessions/{id}/auto-summarize
│   │   │       ├── generate-title/route.ts # POST /api/{sessionId}/sessions/{id}/generate-title
│   │   │       └── status/route.ts # PATCH /api/{sessionId}/sessions/{id}/status
│   │   ├── agents/route.ts    # GET /api/{sessionId}/chat/agents
│   │   ├── streaming/
│   │   │   ├── route.ts       # GET /api/{sessionId}/chat/streaming
│   │   │   └── [sessionId]/events/route.ts # GET /api/{sessionId}/chat/streaming/{sessionId}/events
│   │   ├── gateway/messages/route.ts # GET, POST /api/{sessionId}/chat/gateway/messages
│   │   └── idle-check/route.ts # GET /api/{sessionId}/chat/sessions/idle-check
│   ├── workspaces/
│   │   ├── route.ts          # GET, POST /api/{sessionId}/workspaces
│   │   ├── current/route.ts  # GET /api/{sessionId}/workspaces/current
│   │   ├── members/route.ts  # GET /api/{sessionId}/workspaces/members
│   │   ├── settings/route.ts # GET, PATCH /api/{sessionId}/workspaces/settings
│   │   ├── create/route.ts   # POST /api/{sessionId}/workspaces/create
│   │   └── switch/route.ts   # POST /api/{sessionId}/workspaces/switch
│   ├── user/
│   │   └── settings/route.ts # GET, PATCH /api/{sessionId}/user/settings
│   ├── agent-tools/
│   │   └── route.ts         # GET /api/{sessionId}/agent-tools
│   ├── logs/
│   │   └── route.ts        # POST /api/{sessionId}/logs
│   └── attachments/
│       └── [...path]/route.ts # GET /api/{sessionId}/attachments/{...path}
│
├── tickets/                    # DEPRECATED: Flat paths (keep for backward compat)
│   ├── [ticketId]_[sessionToken]/
│   │   ├── next/route.ts
│   │   ├── finished/route.ts
│   │   ├── failed/route.ts
│   │   └── pause/route.ts
│   └── ...
│
├── deprecated/                 # Mark deprecated, do not modify
│   ├── gateways-pair-route.ts
│   ├── gateways-connect-with-token.ts
│   └── gateways-pair.ts
│
├── auth/                       # Auth routes (no session scope - they're auth)
│   ├── login/route.ts
│   ├── logout/route.ts
│   ├── me/route.ts
│   └── change-password/route.ts
│
├── setup/                      # Setup routes (no session scope - setup context)
│   ├── check/route.ts
│   └── create/route.ts
│
├── cron/
│   └── stale-check/route.ts  # No session scope - cron job
│
├── chat/
│   ├── ws/route.ts           # WebSocket upgrade (no session in URL)
│   └── streaming/route.ts    # POST without sessionId in path
│
└── user/
    └── settings/route.ts     # No session scope (uses cookie)
```

---

### 3. Route Migration Priority

| Priority | Category | Count | Blocked By |
|----------|----------|-------|------------|
| **P0** | Session Verification Utility | 1 file | None |
| **P1** | GET Routes - Tickets | ~8 | P0 |
| **P1** | GET Routes - Others | ~27 | P0 |
| **P1** | POST Routes - Tickets | ~6 | P0 |
| **P1** | POST Routes - Others | ~19 | P0 |
| **P2** | PUT/PATCH/DELETE Routes | ~15 | P1 routes |
| **P1** | Flow Template Update | 1 file | P0 |
| **P3** | README.md Update | 1 file | All above |

---

### 4. flow-template.ts Updates

**File:** `lib/utils/flow-template.ts`

**Changes:**
1. Update API contract section to use session-scoped paths
2. Add explicit verification definitions for each flow action
3. Add `verifySession()` usage documentation

**Updated API Contract Section:**

```xml
<api_contract mode="session_scoped">
  <flow_read>
    <endpoint method="GET">/api/{sessionId}/tickets/{ticketId}/flow/view</endpoint>
    <purpose>Get latest ticket, flow configuration, comments, and flow history.</purpose>
    <verification>
      <session_token_in>URL path parameter</session_token_in>
      <gateway_token_in>Authorization header (Bearer)</gateway_token_in>
    </verification>
  </flow_read>

  <comments>
    <endpoint method="POST">/api/{sessionId}/tickets/{ticketId}/comments</endpoint>
    <required_before_terminal_action>true</required_before_terminal_action>
    <body_example><![CDATA[
{
  "content": "[Agent {$agentId}] Status={$currentStatusName} | Changed: ... | Validated: ... | Remaining: ...",
  "is_agent_completion_signal": false
}
    ]]></body_example>
    <verification>
      <intent>post_comment</intent>
      <description>Post progress comment before terminal action</description>
    </verification>
  </comments>

  <flow_callbacks session_scoped="true">
    <callback name="next" method="POST" endpoint="/api/{sessionId}/tickets/{ticketId}/next">
      <body_example><![CDATA[{ "notes": "Advanced to next stage. Summary: ..." }]]></body_example>
      <verification>
        <intent>advance_flow</intent>
        <description>Advance ticket to next flow stage</description>
        <requires_session>true</requires_session>
        <validates>ticket ownership, flow enabled, not at terminal state</validates>
      </verification>
    </callback>
    <callback name="finished" method="POST" endpoint="/api/{sessionId}/tickets/{ticketId}/finished">
      <body_example><![CDATA[{ "notes": "Completed status {$currentStatusName}. Summary: ... | Evidence: ... | Handoff: ..." }]]></body_example>
      <verification>
        <intent>finish_flow</intent>
        <description>Mark ticket flow as complete (from 'done' status)</description>
        <requires_session>true</requires_session>
        <validates>ticket ownership, at 'done' status, not already completed</validates>
      </verification>
    </callback>
    <callback name="failed" method="POST" endpoint="/api/{sessionId}/tickets/{ticketId}/failed">
      <body_example><![CDATA[{ "notes": "Failed in status {$currentStatusName}. Root cause: ... | Attempted: ... | Needs: ..." }]]></body_example>
      <verification>
        <intent>fail_flow</intent>
        <description>Mark ticket flow step as failed</description>
        <requires_session>true</requires_session>
        <validates>ticket ownership, flow enabled</validates>
      </verification>
    </callback>
    <callback name="pause" method="POST" endpoint="/api/{sessionId}/tickets/{ticketId}/pause">
      <body_example><![CDATA[{ "notes": "Paused in status {$currentStatusName}. Required input: ... | Reason: ... | Resume when: ..." }]]></body_example>
      <verification>
        <intent>pause_flow</intent>
        <description>Pause ticket flow pending external input</description>
        <requires_session>true</requires_session>
        <validates>ticket ownership, flow enabled</validates>
      </verification>
    </callback>
  </flow_callbacks>

  <ticket_management session_scoped="true">
    <endpoint method="GET">/api/{sessionId}/tickets</endpoint>
    <endpoint method="POST">/api/{sessionId}/tickets</endpoint>
    <endpoint method="GET">/api/{sessionId}/tickets/{ticketId}</endpoint>
    <endpoint method="PATCH">/api/{sessionId}/tickets/{ticketId}</endpoint>
    <endpoint method="DELETE">/api/{sessionId}/tickets/{ticketId}</endpoint>
    <verification>
      <intent>manage_tickets</intent>
      <description>Full ticket CRUD operations</description>
    </verification>
  </ticket_management>

  <intent_definitions>
    <intent name="get_ticket">
      <method>GET</method>
      <path>/api/{sessionId}/tickets/{ticketId}</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="list_tickets">
      <method>GET</method>
      <path>/api/{sessionId}/tickets</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="create_ticket">
      <method>POST</method>
      <path>/api/{sessionId}/tickets</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="update_ticket">
      <method>PATCH</method>
      <path>/api/{sessionId}/tickets/{ticketId}</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="delete_ticket">
      <method>DELETE</method>
      <path>/api/{sessionId}/tickets/{ticketId}</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="post_comment">
      <method>POST</method>
      <path>/api/{sessionId}/tickets/{ticketId}/comments</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="get_comments">
      <method>GET</method>
      <path>/api/{sessionId}/tickets/{ticketId}/comments</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="advance_flow">
      <method>POST</method>
      <path>/api/{sessionId}/tickets/{ticketId}/next</path>
      <verification_level>session</verification_level>
      <notes>Cannot advance from 'done' or 'completed' status</notes>
    </intent>
    <intent name="finish_flow">
      <method>POST</method>
      <path>/api/{sessionId}/tickets/{ticketId}/finished</path>
      <verification_level>session</verification_level>
      <notes>Only from 'done' status, idempotent</notes>
    </intent>
    <intent name="fail_flow">
      <method>POST</method>
      <path>/api/{sessionId}/tickets/{ticketId}/failed</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="pause_flow">
      <method>POST</method>
      <path>/api/{sessionId}/tickets/{ticketId}/pause</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="get_flow_config">
      <method>GET</method>
      <path>/api/{sessionId}/tickets/{ticketId}/flow-config</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="update_flow_config">
      <method>PATCH</method>
      <path>/api/{sessionId}/tickets/{ticketId}/flow-config</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="initialize_flow_config">
      <method>POST</method>
      <path>/api/{sessionId}/tickets/{ticketId}/flow-config/initialize</path>
      <verification_level>session</verification_level>
    </intent>
    <intent name="get_flow_view">
      <method>GET</method>
      <path>/api/{sessionId}/tickets/{ticketId}/flow/view</path>
      <verification_level>session</verification_level>
    </intent>
  </intent_definitions>
</api_contract>
```

---

### 5. Middleware Update

**File:** `middleware.ts` (update)

```typescript
// Add support for sessionId path parameter
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ... existing public routes check ...

  // Extract sessionId from URL path for session-scoped routes
  // Pattern: /api/{sessionId}/...
  let sessionId: string | undefined
  let sessionToken: string | undefined

  const sessionScopedMatch = pathname.match(/^\/api\/([a-zA-Z0-9_-]+)\//)
  if (sessionScopedMatch) {
    sessionId = sessionScopedMatch[1]
    // For session-scoped routes, the sessionId IS the session token
    sessionToken = sessionId
  }

  // Fallback to cookie for non-scoped routes
  if (!sessionToken) {
    sessionToken = request.cookies.get('session_token')?.value
  }

  // Also check compound pattern for legacy flow routes
  if (!sessionToken && pathname.startsWith('/api/tickets/')) {
    const compoundMatch = pathname.match(/\/api\/tickets\/[a-zA-Z0-9_-]+_([a-zA-Z0-9_-]+)\//)
    if (compoundMatch) {
      sessionToken = compoundMatch[1]
    }
  }

  // ... rest of verification logic using sessionToken ...
}
```

---

## 📁 File Manifest

### New Files

| File | Purpose |
|------|---------|
| `lib/session/verify.ts` | Session verification utility |
| `app/api/[sessionId]/tickets/route.ts` | Session-scoped tickets list |
| `app/api/[sessionId]/tickets/[id]/route.ts` | Session-scoped ticket CRUD |
| `app/api/[sessionId]/tickets/[ticketId]/next/route.ts` | Session-scoped /next |
| `app/api/[sessionId]/tickets/[ticketId]/finished/route.ts` | Session-scoped /finished |
| `app/api/[sessionId]/tickets/[ticketId]/failed/route.ts` | Session-scoped /failed |
| `app/api/[sessionId]/tickets/[ticketId]/pause/route.ts` | Session-scoped /pause |
| `app/api/[sessionId]/gateways/route.ts` | Session-scoped gateways |
| `app/api/[sessionId]/statuses/route.ts` | Session-scoped statuses |
| `app/api/[sessionId]/projects/route.ts` | Session-scoped projects |
| `app/api/[sessionId]/skills/route.ts` | Session-scoped skills |
| `app/api/[sessionId]/chat/sessions/route.ts` | Session-scoped chat sessions |
| `app/api/[sessionId]/workspaces/route.ts` | Session-scoped workspaces |
| (and ~40 more session-scoped route files) | |

### Modified Files

| File | Change |
|------|--------|
| `lib/session/index.ts` | Add verifySession export |
| `middleware.ts` | Support sessionId path parameter |
| `lib/utils/flow-template.ts` | Update API contract to session-scoped |
| `README.md` | Document session-scoped API paths |

### Deprecated Files (mark only, do not change)

| File | Status |
|------|--------|
| `app/api/tickets/[ticketId]_[sessionToken]/*` | Deprecated (use session-scoped) |
| `app/api/deprecated/gateways-pair-route.ts` | Deprecated |
| `app/api/deprecated/gateways-connect-with-token.ts` | Deprecated |
| `app/api/deprecated/gateways-pair.ts` | Deprecated |

---

## ✅ Quality Gates

| Gate | Question | Result |
|------|----------|--------|
| 🎯 **Code Quality** | Will the implementation be clean and maintainable? | Yes - centralized verifySession utility |
| ⚡ **Performance** | Can it handle load? | Yes - no additional DB calls |
| 🔒 **Security** | Are all attack surfaces considered? | Yes - dual token verification (session + gateway) |
| 🧪 **Testing** | Is the architecture testable? | Yes - each route is independently testable |
| 🔧 **Maintainability** | Can future developers understand and extend? | Yes - consistent session-scoped pattern |
| 🌍 **Global Ready** | Multi-language support? | N/A - API-only change |
| 🐳 **Docker Ready** | Containerized? | Already containerized |

---

## 🛡️ Security Considerations

1. **Session token exposure in URL** - Session IDs in URLs may appear in logs. Mitigate by:
   - Using short-lived session tokens
   - Not logging full URLs in production
   - Consider using POST body for session token in high-security contexts

2. **Gateway token vs session token** - Distinguish:
   - `session_token` (cookie): User authentication
   - `gateway_token` (Bearer): Agent/gateway authentication
   - Both should be validated separately

3. **Workspace isolation** - Session-scoped routes must verify workspace access:
   ```typescript
   const result = verifySession({ sessionToken, workspaceId: session.current_workspace_id })
   if (!result.valid || result.workspaceId !== expectedWorkspaceId) {
     return 403 Forbidden
   }
   ```

---

## 🚀 Implementation Order

1. **Create `lib/session/verify.ts`** (P0 - blocks all others)
2. **Update `lib/session/index.ts`** - Add verifySession export
3. **Update `middleware.ts`** - Support sessionId path parameter
4. **Create session-scoped route directories** for tickets, gateways, statuses, projects, skills, chat, workspaces, etc.
5. **Update `lib/utils/flow-template.ts`** - Session-scoped API contract
6. **Update `README.md`** - Document API changes and deprecated endpoints
7. **Mark deprecated routes** - Add deprecation notices

---

## 📊 Migration Checklist

- [ ] `lib/session/verify.ts` created
- [ ] `lib/session/index.ts` updated with verifySession export
- [ ] `middleware.ts` updated for sessionId support
- [ ] Tickets routes migrated to `app/api/[sessionId]/tickets/`
- [ ] Gateways routes migrated to `app/api/[sessionId]/gateways/`
- [ ] Statuses routes migrated to `app/api/[sessionId]/statuses/`
- [ ] Projects routes migrated to `app/api/[sessionId]/projects/`
- [ ] Skills routes migrated to `app/api/[sessionId]/skills/`
- [ ] Chat routes migrated to `app/api/[sessionId]/chat/`
- [ ] Workspaces routes migrated to `app/api/[sessionId]/workspaces/`
- [ ] Other routes (agent-tools, logs, attachments, user) migrated
- [ ] `lib/utils/flow-template.ts` updated with session-scoped API contract
- [ ] `README.md` updated with API documentation
- [ ] Deprecated routes marked with deprecation notices

---

**Architecture delivered by:** Structura 🏗️  
**Status:** Ready for coder agent
