/**
 * Session and Gateway Token Verification Utility
 *
 * Unified verification for both session tokens (user) and gateway tokens (agent).
 * This is the foundational utility for all session-scoped API routes.
 *
 * NOTE FOR FUTURE CHANGES:
 * Keep DB-backed token/session validation here (API/server handler layer),
 * NOT in middleware. Middleware should remain lightweight token presence gating
 * only, because runtime/bundling differences can break middleware loading when
 * Node/DB modules are imported there.
 */

import { getDatabase } from '@/lib/db/index.js'
import type { Session, User, Gateway } from '@/lib/db/schema.js'

// ============================================================================
// Type Definitions
// ============================================================================

export interface VerifySessionOptions {
  /** Session token from cookie or URL param */
  sessionToken?: string
  /** Gateway token from Authorization: Bearer header */
  gatewayToken?: string
  /** Optional workspace validation */
  workspaceId?: string
}

export interface SessionVerificationResult {
  /** Whether verification succeeded */
  valid: boolean
  /** User ID (present when session verified with user_id) */
  userId?: string
  /** Workspace ID (present when either verification succeeds) */
  workspaceId?: string
  /** Full user object (present when session verified and user exists) */
  user?: User
  /** Full session object (present when session verified and session exists) */
  session?: Session
  /** Error message (present when NOT valid, OR gateway-only) */
  error?: string
}

export interface ExtractedTokens {
  sessionToken?: string
  gatewayToken?: string
}

// ============================================================================
// Token Extraction
// ============================================================================

/**
 * Extract session and gateway tokens from a Request object.
 *
 * Looks for:
 * - sessionToken: `session_token` cookie OR `session_token` URL search param
 * - gatewayToken: `Authorization: Bearer <token>` header
 */
export function extractToken(request: Request): ExtractedTokens {
  const result: ExtractedTokens = {}

  // Extract session token from cookie header
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim())
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=')
      if (name === 'session_token' && value) {
        result.sessionToken = value
        break
      }
    }
  }

  // Extract session token from URL search params (if not found in cookie)
  if (!result.sessionToken) {
    const url = new URL(request.url)
    const urlSessionToken = url.searchParams.get('session_token')
    if (urlSessionToken) {
      result.sessionToken = urlSessionToken
    }
  }

  // Extract gateway token from Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7)
    if (bearerToken) {
      result.gatewayToken = bearerToken
    }
  }

  return result
}

// ============================================================================
// Session Verification
// ============================================================================

/**
 * Verify session token against the sessions table.
 * Returns the session and associated user if valid.
 */
function verifySessionToken(
  db: ReturnType<typeof getDatabase>,
  sessionToken: string,
  workspaceId?: string
): { session: Session; user: User } | { error: string } {
  // Query session with user join
  const sessionRow = db
    .prepare(
      `SELECT s.*, u.id as u_id, u.email as u_email, u.password_hash as u_password_hash,
              u.is_superuser as u_is_superuser, u.first_password_changed as u_first_password_changed,
              u.created_at as u_created_at, u.updated_at as u_updated_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(sessionToken) as
    | (Session & {
        u_id: string
        u_email: string
        u_password_hash: string
        u_is_superuser: boolean
        u_first_password_changed: boolean
        u_created_at: string
        u_updated_at: string
      })
    | undefined

  if (!sessionRow) {
    return { error: 'Invalid or expired token' }
  }

  // Reconstruct User object from joined columns
  const user: User = {
    id: sessionRow.u_id,
    email: sessionRow.u_email,
    password_hash: sessionRow.u_password_hash,
    is_superuser: sessionRow.u_is_superuser,
    first_password_changed: sessionRow.u_first_password_changed,
    created_at: sessionRow.u_created_at,
    updated_at: sessionRow.u_updated_at,
  }

  // Reconstruct Session object (without user columns)
  const session: Session = {
    id: sessionRow.id,
    user_id: sessionRow.user_id,
    token: sessionRow.token,
    current_workspace_id: sessionRow.current_workspace_id,
    current_identity_id: sessionRow.current_identity_id ?? null,
    expires_at: sessionRow.expires_at,
    created_at: sessionRow.created_at,
  }

  // Validate workspace if specified
  if (workspaceId && session.current_workspace_id !== workspaceId) {
    return { error: 'Workspace mismatch' }
  }

  return { session, user }
}

// ============================================================================
// Gateway Verification
// ============================================================================

/**
 * Verify gateway token against the gateways table.
 * Returns the gateway if valid (agents don't have user context).
 */
function verifyGatewayToken(
  db: ReturnType<typeof getDatabase>,
  gatewayToken: string
): { gateway: Gateway } | { error: string } {
  const gateway = db
    .prepare('SELECT * FROM gateways WHERE auth_token = ?')
    .get(gatewayToken) as Gateway | undefined

  if (!gateway) {
    return { error: 'Invalid or expired token' }
  }

  return { gateway }
}

// ============================================================================
// Main Verification Function
// ============================================================================

/**
 * Unified session/gateway token verification.
 *
 * Handles both:
 * - Session tokens (user/human sessions via cookie)
 * - Gateway tokens (agent tokens via Authorization header)
 *
 * Verification order:
 * 1. If sessionToken provided → verify as session
 * 2. If gatewayToken provided → verify as gateway (agents only)
 * 3. Neither → error
 *
 * @example
 * ```typescript
 * const { sessionToken, gatewayToken } = extractToken(request)
 * const result = verifySession({ sessionToken, gatewayToken })
 *
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 401 })
 * }
 *
 * // Use result.userId, result.workspaceId, result.user, result.session
 * ```
 */
export function verifySession(
  options: VerifySessionOptions
): SessionVerificationResult {
  const { sessionToken, gatewayToken, workspaceId } = options

  // Step 1: Validate input
  if (!sessionToken && !gatewayToken) {
    return { valid: false, error: 'No token provided' }
  }

  const db = getDatabase()

  // Step 2: Session token verification (priority over gateway)
  if (sessionToken) {
    const sessionResult = verifySessionToken(db, sessionToken, workspaceId)

    if ('error' in sessionResult) {
      return { valid: false, error: sessionResult.error }
    }

    const { session, user } = sessionResult

    return {
      valid: true,
      userId: user.id,
      workspaceId: session.current_workspace_id || undefined,
      user,
      session,
    }
  }

  // Step 3: Gateway token verification (for agents)
  if (gatewayToken) {
    const gatewayResult = verifyGatewayToken(db, gatewayToken)

    if ('error' in gatewayResult) {
      return { valid: false, error: gatewayResult.error }
    }

    const { gateway } = gatewayResult

    return {
      valid: true,
      workspaceId: gateway.workspace_id,
      // Note: Gateway tokens represent agents, not human users
      // No userId, user, or session for gateway tokens
      error: 'Gateway token (agent context, no user)',
    }
  }

  // Step 4: Fallback (should not reach here due to Step 1)
  return { valid: false, error: 'Invalid or expired token' }
}
