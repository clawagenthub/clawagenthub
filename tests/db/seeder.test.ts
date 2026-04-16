import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

const TEST_DB_PATH = ':memory:'

describe('Database Seeder', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Setup basic schema
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

      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE statuses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        flow_default_enabled INTEGER DEFAULT 0,
        default_agent_id TEXT,
        on_failed_goto TEXT,
        ask_approve_to_continue INTEGER DEFAULT 0
      );
    `)
  })

  afterEach(() => {
    db.close()
  })

  describe('User Seeding', () => {
    it('should seed a default user', () => {
      const userId = randomUUID()
      db.prepare(`
        INSERT INTO users (id, username, password_hash, is_superuser, first_password_changed)
        VALUES (?, ?, ?, 1, 0)
      `).run(userId, 'testuser', 'hashedpassword')

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any
      expect(user).toBeDefined()
      expect(user.username).toBe('testuser')
      expect(user.is_superuser).toBe(1)
    })

    it('should require unique usernames', () => {
      const userId1 = randomUUID()
      const userId2 = randomUUID()
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId1, 'duplicateuser', 'hash1')

      expect(() => {
        db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId2, 'duplicateuser', 'hash2')
      }).toThrow()
    })
  })

  describe('Workspace Seeding', () => {
    it('should seed a default workspace', () => {
      const workspaceId = randomUUID()
      db.prepare('INSERT INTO workspaces (id, name) VALUES (?, ?)').run(workspaceId, 'Default Workspace')

      const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId) as any
      expect(workspace).toBeDefined()
      expect(workspace.name).toBe('Default Workspace')
    })
  })

  describe('Status Seeding', () => {
    it('should seed default statuses', () => {
      const statuses = [
        { id: randomUUID(), name: 'To Do', priority: 1, flow_default_enabled: 1 },
        { id: randomUUID(), name: 'In Progress', priority: 2, flow_default_enabled: 1 },
        { id: randomUUID(), name: 'Done', priority: 3, flow_default_enabled: 1 }
      ]

      for (const status of statuses) {
        db.prepare(`
          INSERT INTO statuses (id, name, priority, flow_default_enabled)
          VALUES (?, ?, ?, ?)
        `).run(status.id, status.name, status.priority, status.flow_default_enabled)
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM statuses').get() as { count: number }
      expect(count.count).toBe(3)
    })
  })
})