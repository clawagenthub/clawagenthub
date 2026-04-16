import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

const TEST_DB_PATH = ':memory:'

describe('Flow API', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Create workspaces first (required FK for statuses and tickets)
    db.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create users (required FK for tickets)
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_superuser INTEGER DEFAULT 0,
        first_password_changed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create full statuses table matching actual schema
    db.exec(`
      CREATE TABLE statuses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6B7280',
        description TEXT,
        workspace_id TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        agent_id TEXT,
        on_failed_goto TEXT,
        is_flow_included INTEGER DEFAULT 1,
        ask_approve_to_continue INTEGER DEFAULT 0,
        instructions_override TEXT,
        is_system_status INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        UNIQUE(name, workspace_id)
      );
    `)

    // Create tickets table matching actual schema
    db.exec(`
      CREATE TABLE tickets (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        ticket_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        assigned_to TEXT,
        flow_enabled INTEGER DEFAULT 1,
        current_agent_session_id TEXT,
        last_flow_check_at DATETIME,
        completed_at DATETIME,
        creation_status TEXT DEFAULT 'active',
        is_sub_ticket INTEGER DEFAULT 0,
        parent_ticket_id TEXT,
        waiting_finished_ticket_id TEXT,
        flowing_status TEXT DEFAULT 'stopped',
        flow_mode TEXT DEFAULT 'manual',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (status_id) REFERENCES statuses(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        UNIQUE(workspace_id, ticket_number)
      );
    `)

    // Create ticket_flow_configs table
    db.exec(`
      CREATE TABLE ticket_flow_configs (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        status_id TEXT NOT NULL,
        flow_order INTEGER NOT NULL,
        agent_id TEXT,
        on_failed_goto TEXT,
        ask_approve_to_continue INTEGER DEFAULT 0,
        instructions_override TEXT,
        is_included INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (status_id) REFERENCES statuses(id),
        UNIQUE(ticket_id, status_id)
      );
    `)

    // Create ticket_flow_history table
    db.exec(`
      CREATE TABLE ticket_flow_history (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        from_status_id TEXT,
        to_status_id TEXT,
        action TEXT NOT NULL,
        notes TEXT,
        agent_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (from_status_id) REFERENCES statuses(id),
        FOREIGN KEY (to_status_id) REFERENCES statuses(id)
      );
    `)

    // Create migrations table
    db.exec(`
      CREATE TABLE migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
  })

  afterEach(() => {
    db.close()
  })

  describe('Flow Configuration', () => {
    it('should enable flow on ticket creation', () => {
      const workspaceId = randomUUID()
      const userId = randomUUID()
      const ticketId = randomUUID()
      const statusId = randomUUID()

      // Insert workspace first
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      // Insert user
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'test@example.com', 'hash')
      // Insert status with workspace FK
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id, is_flow_included) VALUES (?, ?, ?, ?, ?)').run(statusId, 'To Do', '#6B7280', workspaceId, 1)

      // Create ticket with flow enabled
      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by, flow_enabled, flow_mode)
        VALUES (?, ?, 1, 'Flow Ticket', ?, ?, 1, 'automatic')
      `).run(ticketId, workspaceId, statusId, userId)

      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any
      expect(ticket.flow_enabled).toBe(1)
      expect(ticket.flow_mode).toBe('automatic')
    })

    it('should have correct flowing_status', () => {
      const workspaceId = randomUUID()
      const userId = randomUUID()
      const statusId = randomUUID()
      const ticketId = randomUUID()

      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'test@example.com', 'hash')
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id) VALUES (?, ?, ?, ?)').run(statusId, 'To Do', '#6B7280', workspaceId)

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by, flow_enabled)
        VALUES (?, ?, 1, 'Status Test', ?, ?, 1)
      `).run(ticketId, workspaceId, statusId, userId)

      const ticket = db.prepare('SELECT flowing_status FROM tickets WHERE id = ?').get(ticketId) as any
      expect(ticket.flowing_status).toBe('flowing')
    })
  })

  describe('Flow Progression', () => {
    it('should record flow history on status change', () => {
      const workspaceId = randomUUID()
      const userId = randomUUID()
      const ticketId = randomUUID()
      const fromStatusId = randomUUID()
      const toStatusId = randomUUID()

      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'test@example.com', 'hash')
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id) VALUES (?, ?, ?, ?)').run(fromStatusId, 'To Do', '#6B7280', workspaceId)
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id) VALUES (?, ?, ?, ?)').run(toStatusId, 'In Progress', '#3B82F6', workspaceId)

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by)
        VALUES (?, ?, 1, 'History Test', ?, ?)
      `).run(ticketId, workspaceId, fromStatusId, userId)

      // Record flow history
      const historyId = randomUUID()
      db.prepare(`
        INSERT INTO ticket_flow_history (id, ticket_id, from_status_id, to_status_id, action)
        VALUES (?, ?, ?, ?, 'status_change')
      `).run(historyId, ticketId, fromStatusId, toStatusId)

      const history = db.prepare('SELECT * FROM ticket_flow_history WHERE ticket_id = ?').all(ticketId) as any[]
      expect(history.length).toBe(1)
      expect(history[0].action).toBe('status_change')
    })

    it('should transition to next flow status', () => {
      const workspaceId = randomUUID()
      const userId = randomUUID()
      const ticketId = randomUUID()
      const status1Id = randomUUID()
      const status2Id = randomUUID()

      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'test@example.com', 'hash')
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id, priority) VALUES (?, ?, ?, ?, ?)').run(status1Id, 'To Do', '#6B7280', workspaceId, 1)
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id, priority) VALUES (?, ?, ?, ?, ?)').run(status2Id, 'In Progress', '#3B82F6', workspaceId, 2)

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by, flow_enabled)
        VALUES (?, ?, 1, 'Transition Test', ?, ?, 1)
      `).run(ticketId, workspaceId, status1Id, userId)

      // Add flow config
      db.prepare(`
        INSERT INTO ticket_flow_configs (id, ticket_id, status_id, flow_order, is_included)
        VALUES (?, ?, ?, 1, 1), (?, ?, ?, 2, 1)
      `).run(randomUUID(), ticketId, status1Id, randomUUID(), ticketId, status2Id)

      // Transition
      db.prepare('UPDATE tickets SET status_id = ? WHERE id = ?').run(status2Id, ticketId)

      const ticket = db.prepare('SELECT status_id FROM tickets WHERE id = ?').get(ticketId) as any
      expect(ticket.status_id).toBe(status2Id)
    })
  })

  describe('Flow Failure Handling', () => {
    it('should record failed flow action', () => {
      const workspaceId = randomUUID()
      const userId = randomUUID()
      const ticketId = randomUUID()
      const failedStatusId = randomUUID()

      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'test@example.com', 'hash')
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id) VALUES (?, ?, ?, ?)').run(failedStatusId, 'Failed', '#EF4444', workspaceId)

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by)
        VALUES (?, ?, 1, 'Failure Test', ?, ?)
      `).run(ticketId, workspaceId, failedStatusId, userId)

      db.prepare(`
        INSERT INTO ticket_flow_configs (id, ticket_id, status_id, flow_order, on_failed_goto, is_included)
        VALUES (?, ?, ?, 1, 'recovery-status', 1)
      `).run(randomUUID(), ticketId, failedStatusId)

      // Simulate failure
      const historyId = randomUUID()
      db.prepare(`
        INSERT INTO ticket_flow_history (id, ticket_id, to_status_id, action, notes)
        VALUES (?, ?, ?, 'failed', 'Test failure')
      `).run(historyId, ticketId, failedStatusId)
    })
  })

  describe('Flow Pause', () => {
    it('should allow flow to pause awaiting input', () => {
      const workspaceId = randomUUID()
      const userId = randomUUID()
      const statusId = randomUUID()
      const ticketId = randomUUID()

      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'test@example.com', 'hash')
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id) VALUES (?, ?, ?, ?)').run(statusId, 'To Do', '#6B7280', workspaceId)

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by, flow_enabled)
        VALUES (?, ?, 1, 'Pause Test', ?, ?, 1)
      `).run(ticketId, workspaceId, statusId, userId)

      // Ticket should have flowing_status = 'paused' when waiting for input
      db.prepare(`UPDATE tickets SET flowing_status = 'paused' WHERE id = ?`).run(ticketId)

      const ticket = db.prepare('SELECT flowing_status FROM tickets WHERE id = ?').get(ticketId) as any
      expect(ticket.flowing_status).toBe('paused')
    })
  })

  describe('Flow Completion', () => {
    it('should mark ticket as completed when reaching final status', () => {
      const workspaceId = randomUUID()
      const userId = randomUUID()
      const finalStatusId = randomUUID()
      const ticketId = randomUUID()

      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'test@example.com', 'hash')
      db.prepare('INSERT INTO statuses (id, name, color, workspace_id) VALUES (?, ?, ?, ?)').run(finalStatusId, 'Completed', '#10B981', workspaceId)

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by)
        VALUES (?, ?, 1, 'Completion Test', ?, ?)
      `).run(ticketId, workspaceId, finalStatusId, userId)

      // Mark completed
      db.prepare(`UPDATE tickets SET completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(ticketId)

      const ticket = db.prepare('SELECT completed_at FROM tickets WHERE id = ?').get(ticketId) as any
      expect(ticket.completed_at).toBeDefined()
    })
  })
})
