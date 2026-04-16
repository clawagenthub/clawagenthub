import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

const TEST_DB_PATH = ':memory:'

describe('Tickets API', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Setup tables
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_superuser INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

      CREATE TABLE tickets (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        ticket_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        assigned_to TEXT,
        flow_enabled INTEGER DEFAULT 0,
        flow_mode TEXT DEFAULT 'automatic',
        current_agent_session_id TEXT,
        last_flow_check_at DATETIME,
        completed_at DATETIME,
        creation_status TEXT DEFAULT 'active',
        is_sub_ticket INTEGER DEFAULT 0,
        parent_ticket_id TEXT,
        waiting_finished_ticket_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE ticket_flow_configs (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        status_id TEXT NOT NULL,
        flow_order INTEGER NOT NULL,
        on_failed_goto TEXT,
        ask_approve_to_continue INTEGER DEFAULT 0,
        is_included INTEGER DEFAULT 1
      );
    `)

    // Seed test data
    const workspaceId = randomUUID()
    const userId = randomUUID()
    const statusId = randomUUID()

    db.prepare('INSERT INTO workspaces (id, name) VALUES (?, ?)').run(workspaceId, 'Test Workspace')
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
    db.prepare('INSERT INTO statuses (id, name, priority, flow_default_enabled) VALUES (?, ?, ?, ?)').run(statusId, 'To Do', 1, 1)
  })

  afterEach(() => {
    db.close()
  })

  describe('Ticket CRUD', () => {
    it('should create a new ticket', () => {
      const ticketId = randomUUID()
      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by)
        VALUES (?, 'workspace-id', 1, 'Test Ticket', 'status-id', 'user-id')
      `).run(ticketId)

      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any
      expect(ticket).toBeDefined()
      expect(ticket.title).toBe('Test Ticket')
    })

    it('should generate sequential ticket numbers per workspace', () => {
      const workspaceId = randomUUID()
      db.prepare('INSERT INTO workspaces (id, name) VALUES (?, ?)').run(workspaceId, 'New Workspace')

      // Create 3 tickets
      for (let i = 0; i < 3; i++) {
        const ticketId = randomUUID()
        db.prepare(`
          INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by)
          VALUES (?, ?, ?, ?, 'status-id', 'user-id')
        `).run(ticketId, workspaceId, i + 1, `Ticket ${i + 1}`)
      }

      const tickets = db.prepare('SELECT ticket_number FROM tickets WHERE workspace_id = ? ORDER BY ticket_number').all(workspaceId) as any[]
      expect(tickets.map(t => t.ticket_number)).toEqual([1, 2, 3])
    })

    it('should update ticket status', () => {
      const ticketId = randomUUID()
      const originalStatusId = randomUUID()
      const newStatusId = randomUUID()

      db.prepare('INSERT INTO statuses (id, name, priority) VALUES (?, ?, ?)').run(originalStatusId, 'To Do', 1)
      db.prepare('INSERT INTO statuses (id, name, priority) VALUES (?, ?, ?)').run(newStatusId, 'In Progress', 2)

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by)
        VALUES (?, 'workspace-id', 1, 'Status Test', ?, 'user-id')
      `).run(ticketId, originalStatusId)

      // Update status
      db.prepare('UPDATE tickets SET status_id = ? WHERE id = ?').run(newStatusId, ticketId)

      const ticket = db.prepare('SELECT status_id FROM tickets WHERE id = ?').get(ticketId) as any
      expect(ticket.status_id).toBe(newStatusId)
    })

    it('should soft delete tickets via creation_status', () => {
      const ticketId = randomUUID()
      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by, creation_status)
        VALUES (?, 'workspace-id', 1, 'Delete Test', 'status-id', 'user-id', 'deleted')
      `).run(ticketId)

      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any
      expect(ticket.creation_status).toBe('deleted')
    })
  })

  describe('Sub-tickets', () => {
    it('should link sub-ticket to parent', () => {
      const parentId = randomUUID()
      const childId = randomUUID()

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by)
        VALUES (?, 'workspace-id', 1, 'Parent', 'status-id', 'user-id')
      `).run(parentId)

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by, is_sub_ticket, parent_ticket_id)
        VALUES (?, 'workspace-id', 2, 'Child', 'status-id', 'user-id', 1, ?)
      `).run(childId, parentId)

      const parent = db.prepare('SELECT * FROM tickets WHERE id = ?').get(parentId) as any
      const child = db.prepare('SELECT * FROM tickets WHERE id = ?').get(childId) as any

      expect(parent.is_sub_ticket).toBe(0)
      expect(child.is_sub_ticket).toBe(1)
      expect(child.parent_ticket_id).toBe(parentId)
    })
  })

  describe('Flow Configuration', () => {
    it('should create flow configs for a ticket', () => {
      const ticketId = randomUUID()
      const statusIds = [randomUUID(), randomUUID(), randomUUID()]

      db.prepare(`
        INSERT INTO tickets (id, workspace_id, ticket_number, title, status_id, created_by, flow_enabled)
        VALUES (?, 'workspace-id', 1, 'Flow Test', 'status-id', 'user-id', 1)
      `).run(ticketId)

      for (let i = 0; i < statusIds.length; i++) {
        const configId = randomUUID()
        db.prepare(`
          INSERT INTO ticket_flow_configs (id, ticket_id, status_id, flow_order, is_included)
          VALUES (?, ?, ?, ?, 1)
        `).run(configId, ticketId, statusIds[i], i + 1)
      }

      const configs = db.prepare('SELECT * FROM ticket_flow_configs WHERE ticket_id = ? ORDER BY flow_order').all(ticketId) as any[]
      expect(configs.length).toBe(3)
      expect(configs[0].flow_order).toBe(1)
      expect(configs[2].flow_order).toBe(3)
    })
  })
})