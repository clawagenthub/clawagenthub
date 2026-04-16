import { getDatabase } from '../db/index.js'
import { generateSessionToken, generateUserId } from './token.js'
import type { Session, User } from '../db/schema.js'

const SESSION_DURATION = parseInt(
  process.env.SESSION_DURATION || '86400000',
  10
) // 24 hours

interface CreateSessionOptions {
  workspaceId?: string | null
}

function resolveDefaultWorkspaceId(userId: string): string | null {
  const db = getDatabase()
  const membership = db
    .prepare(
      `SELECT wm.workspace_id
       FROM workspace_members wm
       INNER JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.user_id = ?
       ORDER BY CASE WHEN w.owner_id = ? THEN 0 ELSE 1 END, w.created_at ASC, wm.joined_at ASC
       LIMIT 1`
    )
    .get(userId, userId) as { workspace_id: string } | undefined

  return membership?.workspace_id || null
}

export function createSession(
  userId: string,
  origin?: string | null,
  options?: CreateSessionOptions
): Session {
  const db = getDatabase()
  const sessionId = generateUserId()
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)
  const currentWorkspaceId =
    options?.workspaceId ?? resolveDefaultWorkspaceId(userId)

  db.prepare(
    `INSERT INTO sessions (
      id, user_id, token, current_workspace_id, expires_at, origin
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    userId,
    token,
    currentWorkspaceId,
    expiresAt.toISOString(),
    origin || null
  )

  return {
    id: sessionId,
    user_id: userId,
    token,
    current_workspace_id: currentWorkspaceId,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
  }
}

export function validateSession(token: string): Session | null {
  const db = getDatabase()
  const session = db
    .prepare(
      `SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`
    )
    .get(token) as Session | undefined

  return session || null
}

export function getUserFromSession(token: string): User | null {
  const db = getDatabase()
  const result = db
    .prepare(
      `
    SELECT u.* FROM users u
    INNER JOIN sessions s ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `
    )
    .get(token) as User | undefined

  return result || null
}

export function deleteSession(token: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function deleteUserSessions(userId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

export function cleanupExpiredSessions(): void {
  const db = getDatabase()
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run()
}

/**
 * Get origin from session token
 */
export function getSessionOrigin(sessionToken: string): string | null {
  const db = getDatabase()
  const session = db
    .prepare(
      `SELECT origin FROM sessions WHERE token = ? AND expires_at > datetime('now')`
    )
    .get(sessionToken) as { origin: string | null } | undefined

  return session?.origin || null
}
