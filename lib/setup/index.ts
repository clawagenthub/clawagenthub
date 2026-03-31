import { getDatabase } from '../db/index.js'
import { generateSetupToken, generateUserId } from '../auth/token.js'
import { hashPassword } from '../auth/password.js'
import type { SetupToken, User } from '../db/schema.js'

const SETUP_TOKEN_DURATION =
  parseInt(process.env.SETUP_TOKEN_DURATION || '3600000', 10) // 1 hour

export function checkSetupRequired(): boolean {
  const db = getDatabase()
  const result = db
    .prepare('SELECT COUNT(*) as count FROM users WHERE is_superuser = 1')
    .get() as { count: number }

  return result.count === 0
}

export function createSetupToken(): string {
  const db = getDatabase()
  const token = generateSetupToken()
  const tokenId = generateUserId()
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_DURATION)

  db.prepare(
    `INSERT INTO setup_tokens (id, token, expires_at) VALUES (?, ?, ?)`
  ).run(tokenId, token, expiresAt.toISOString())

  return token
}

export function validateSetupToken(token: string): boolean {
  const db = getDatabase()
  const result = db
    .prepare(
      `SELECT * FROM setup_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')`
    )
    .get(token) as SetupToken | undefined

  return !!result
}

export function markSetupTokenUsed(token: string): void {
  const db = getDatabase()
  db.prepare('UPDATE setup_tokens SET used = 1 WHERE token = ?').run(token)
}

export async function createSuperuser(
  email: string,
  password: string,
  setupToken: string
): Promise<User> {
  // Validate setup token
  if (!validateSetupToken(setupToken)) {
    throw new Error('Invalid or expired setup token')
  }

  // Check if setup is still required
  if (!checkSetupRequired()) {
    throw new Error('Superuser already exists')
  }

  const db = getDatabase()
  const userId = generateUserId()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO users (id, email, password_hash, is_superuser, first_password_changed, created_at, updated_at)
     VALUES (?, ?, ?, 1, 0, ?, ?)`
  ).run(userId, email, passwordHash, now, now)

  // Mark token as used
  markSetupTokenUsed(setupToken)

  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId) as User

  return user
}

export function displaySetupUrl(token: string): void {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const setupUrl = `${baseUrl}/setup?token=${token}`

  console.info('\n' + '='.repeat(70))
  console.info('⚠️  No superuser found!')
  console.info('')
  console.info('📝 Create your first superuser account:')
  console.info(`   ${setupUrl}`)
  console.info('')
  console.info('   This link expires in 1 hour and can only be used once.')
  console.info('='.repeat(70) + '\n')
}
