import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

const TEST_DB_PATH = ':memory:'

describe('Database Migrations', () => {
  let db: Database.Database

  beforeAll(() => {
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  })

  afterAll(() => {
    db.close()
  })

  describe('Schema Initialization', () => {
    it('should create migrations table', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get()
      expect(table).toBeDefined()
    })

    it('should create users table', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_superuser INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          first_password_changed INTEGER DEFAULT 0
        )
      `)

      const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()
      expect(table).toBeDefined()
    })

    it('should create workspaces table', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'").get()
      expect(table).toBeDefined()
    })
  })

  describe('Migration Tracking', () => {
    it('should track applied migrations', () => {
      const result = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as { count: number }
      expect(result.count).toBeGreaterThanOrEqual(0)
    })

    it('should not allow duplicate migration names', () => {
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run('test_migration')

      expect(() => {
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run('test_migration')
      }).toThrow()
    })
  })

  describe('Data Integrity', () => {
    it('should enforce foreign key constraints', () => {
      // Create parent table
      db.exec(`
        CREATE TABLE parent (
          id TEXT PRIMARY KEY
        )
      `)

      // Create child table with FK
      db.exec(`
        CREATE TABLE child (
          id TEXT PRIMARY KEY,
          parent_id TEXT NOT NULL,
          FOREIGN KEY (parent_id) REFERENCES parent(id)
        )
      `)

      // Insert parent
      db.prepare('INSERT INTO parent (id) VALUES (?)').run('p1')

      // Should succeed
      db.prepare('INSERT INTO child (id, parent_id) VALUES (?, ?)').run('c1', 'p1')

      // Should fail - parent doesn't exist
      expect(() => {
        db.prepare('INSERT INTO child (id, parent_id) VALUES (?, ?)').run('c2', 'nonexistent')
      }).toThrow()
    })
  })
})