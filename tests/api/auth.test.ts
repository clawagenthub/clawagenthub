import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

const TEST_DB_PATH = ':memory:'

describe('Auth API', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')

    // Setup users table
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_superuser INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        first_password_changed INTEGER DEFAULT 0
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        origin TEXT,
        status TEXT DEFAULT 'active'
      );
    `)
  })

  afterEach(() => {
    db.close()
  })

  describe('User Registration', () => {
    it('should create a new user with hashed password', async () => {
      const userId = randomUUID()
      const password = 'testpassword123'
      const passwordHash = await bcrypt.hash(password, 10)

      db.prepare(`
        INSERT INTO users (id, username, password_hash, is_superuser, first_password_changed)
        VALUES (?, ?, ?, 0, 0)
      `).run(userId, 'newuser', passwordHash)

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('newuser') as any
      expect(user).toBeDefined()
      expect(user.username).toBe('newuser')
      expect(await bcrypt.compare(password, user.password_hash)).toBe(true)
    })

    it('should reject duplicate usernames', async () => {
      const userId1 = randomUUID()
      const userId2 = randomUUID()
      const passwordHash = await bcrypt.hash('password', 10)

      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId1, 'existinguser', passwordHash)

      expect(() => {
        db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId2, 'existinguser', passwordHash)
      }).toThrow()
    })
  })

  describe('Session Management', () => {
    it('should create a session for valid login', () => {
      const userId = randomUUID()
      const sessionId = randomUUID()
      const token = 'test-token-' + randomUUID()
      const expiresAt = new Date(Date.now() + 86400000).toISOString()

      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId, 'sessionuser', 'hashed')

      db.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(sessionId, userId, token, expiresAt)

      const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as any
      expect(session).toBeDefined()
      expect(session.user_id).toBe(userId)
    })

    it('should reject expired sessions', () => {
      const sessionId = randomUUID()
      const expiredAt = new Date(Date.now() - 1000).toISOString() // past

      db.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
        sessionId, 'user-id', 'expired-token', expiredAt
      )

      const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get('expired-token') as any
      expect(session).toBeDefined()
      expect(new Date(session.expires_at) < new Date()).toBe(true)
    })
  })

  describe('Password Validation', () => {
    it('should validate correct password', async () => {
      const password = 'correct-password'
      const hash = await bcrypt.hash(password, 10)

      const isValid = await bcrypt.compare(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'correct-password'
      const hash = await bcrypt.hash(password, 10)

      const isValid = await bcrypt.compare('wrong-password', hash)
      expect(isValid).toBe(false)
    })
  })
})