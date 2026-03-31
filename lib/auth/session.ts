import { getDatabase } from '../db/index.js'
import { generateSessionToken, generateUserId } from './token.js'
import type { Session, User } from '../db/schema.js'

const SESSION_DURATION =
  parseInt(process.env.SESSION_DURATION || '86400000', 10) // 24 hours

export function createSession(userId: string, origin?: string | null): Session {
  const db = getDatabase()
  const sessionId = generateUserId()
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at, origin) VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, userId, token, expiresAt.toISOString(), origin || null)

  return {
    id: sessionId,
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
    origin: origin || null,
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
