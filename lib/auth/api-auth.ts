import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getUserFromSession, validateSession } from './session.js'
import { getDatabase } from '../db/index.js'
import type { User, Session } from '../db/schema.js'

/**
 * Cookie name used throughout the application
 */
export const SESSION_COOKIE_NAME = 'session_token'

/**
 * Extract session token from cookies using Next.js helper
 * This is the ONLY correct way to read cookies in API routes
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null
}

/**
 * Validate session and return session data
 */
export async function validateApiSession(): Promise<Session | null> {
  const token = await getSessionToken()
  if (!token) return null
  
  return validateSession(token)
}

/**
 * Get authenticated user from session
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const token = await getSessionToken()
  if (!token) return null
  
  return getUserFromSession(token)
}

/**
 * Get user with workspace context
 * Returns user, session, and current workspace ID
 */
export async function getUserWithWorkspace(): Promise<{
  user: User
  session: Session
  workspaceId: string
} | null> {
  const token = await getSessionToken()
  if (!token) return null
  
  const db = getDatabase()
  
  // Get session with workspace
  const session = db
    .prepare(`SELECT * FROM sessions WHERE token = ? AND datetime(expires_at) > datetime('now')`)
    .get(token) as Session | undefined
  
  console.log('[Auth] Session lookup result:', session ? {
    id: session.id,
    userId: session.user_id,
    currentWorkspaceId: session.current_workspace_id,
    expiresAt: session.expires_at
  } : 'No session found')
  
  if (!session) {
    console.error('[Auth] No valid session found for token')
    return null
  }
  
  if (!session.current_workspace_id) {
    console.error('[Auth] Session found but no current_workspace_id set. Session:', { id: session.id, userId: session.user_id })
    return null
  }
  
  // Get user
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(session.user_id) as User | undefined
  
  if (!user) return null
  
  return {
    user,
    session,
    workspaceId: session.current_workspace_id
  }
}

/**
 * Unified unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

/**
 * Unified forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

/**
 * Check if session cookie is present and correctly named
 * Useful for debugging authentication issues
 */
export async function debugSessionCookie(): Promise<{
  hasCookie: boolean
  cookieName: string
  tokenPreview?: string
}> {
  const token = await getSessionToken()
  return {
    hasCookie: !!token,
    cookieName: SESSION_COOKIE_NAME,
    tokenPreview: token ? `${token.substring(0, 10)}...` : undefined
  }
}
