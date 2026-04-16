import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

const TEST_DB_PATH = ':memory:'

describe('Browser Automation Integration', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Create workspaces first (required FK)
    db.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create users (required FK)
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

    // Create gateways (required FK for chat_sessions)
    db.exec(`
      CREATE TABLE gateways (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        auth_token TEXT NOT NULL,
        status TEXT DEFAULT 'disconnected',
        last_connected_at TEXT,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );
    `)

    // Create sessions table
    db.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        current_workspace_id TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        origin TEXT,
        status TEXT DEFAULT 'active',
        description TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `)

    // Create chat_sessions table matching actual schema
    db.exec(`
      CREATE TABLE chat_sessions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        gateway_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        session_key TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE CASCADE
      );
    `)

    // Create chat_messages table
    db.exec(`
      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      );
    `)

    // Create browser_actions table (for tracking browser automation)
    db.exec(`
      CREATE TABLE browser_actions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        target TEXT,
        payload TEXT,
        result TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      );
    `)
  })

  afterEach(() => {
    db.close()
  })

  describe('Chat Session Management', () => {
    it('should create a chat session linked to user session', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const sessionId = randomUUID()
      const chatSessionId = randomUUID()

      // Setup dependencies
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )
      db.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
        sessionId, userId, 'test-token', new Date(Date.now() + 86400000).toISOString()
      )

      // Create chat session
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-agent', 'Browser Agent', 'agent:browser-agent:main')

      const chatSession = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(chatSessionId) as any
      expect(chatSession).toBeDefined()
      expect(chatSession.workspace_id).toBe(workspaceId)
      expect(chatSession.agent_id).toBe('browser-agent')
    })

    it('should track chat messages in order', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const chatSessionId = randomUUID()

      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-agent', 'Browser Agent', 'agent:browser-agent:main')

      const messages = [
        { role: 'user', content: 'Navigate to example.com' },
        { role: 'assistant', content: 'Navigating to example.com' },
        { role: 'assistant', content: 'Page loaded successfully' }
      ]

      for (const msg of messages) {
        db.prepare(`INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`).run(
          randomUUID(), chatSessionId, msg.role, msg.content
        )
      }

      const storedMessages = db.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at').all(chatSessionId) as any[]
      expect(storedMessages.length).toBe(3)
      expect(storedMessages[0].content).toBe('Navigate to example.com')
      expect(storedMessages[2].content).toBe('Page loaded successfully')
    })
  })

  describe('Browser Action Recording', () => {
    it('should record browser navigation action', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const chatSessionId = randomUUID()
      const actionId = randomUUID()

      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-agent', 'Browser Agent', 'agent:browser-agent:main')

      db.prepare(`
        INSERT INTO browser_actions (id, session_id, action_type, target, payload, status) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        actionId,
        chatSessionId,
        'navigate',
        'https://example.com',
        JSON.stringify({ waitUntil: 'networkidle2' }),
        'completed'
      )

      const action = db.prepare('SELECT * FROM browser_actions WHERE id = ?').get(actionId) as any
      expect(action).toBeDefined()
      expect(action.action_type).toBe('navigate')
      expect(action.target).toBe('https://example.com')
      expect(action.status).toBe('completed')
    })

    it('should record browser click action', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const chatSessionId = randomUUID()
      const actionId = randomUUID()

      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-agent', 'Browser Agent', 'agent:browser-agent:main')

      db.prepare(`
        INSERT INTO browser_actions (id, session_id, action_type, target, payload) VALUES (?, ?, ?, ?, ?)
      `).run(
        actionId,
        chatSessionId,
        'click',
        'button#submit',
        JSON.stringify({ button: 'left', clickCount: 1 })
      )

      const action = db.prepare('SELECT * FROM browser_actions WHERE id = ?').get(actionId) as any
      expect(action.action_type).toBe('click')
      expect(action.target).toBe('button#submit')
    })

    it('should record browser fill action', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const chatSessionId = randomUUID()
      const actionId = randomUUID()

      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-agent', 'Browser Agent', 'agent:browser-agent:main')

      db.prepare(`
        INSERT INTO browser_actions (id, session_id, action_type, target, payload) VALUES (?, ?, ?, ?, ?)
      `).run(
        actionId,
        chatSessionId,
        'fill',
        'input[name="email"]',
        JSON.stringify({ value: 'test@example.com' })
      )

      const action = db.prepare('SELECT * FROM browser_actions WHERE id = ?').get(actionId) as any
      expect(action.action_type).toBe('fill')
      expect(action.target).toBe('input[name="email"]')
      expect(JSON.parse(action.payload).value).toBe('test@example.com')
    })

    it('should track action status (pending/completed/failed)', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const chatSessionId = randomUUID()

      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-agent', 'Browser Agent', 'agent:browser-agent:main')

      // Create actions with different statuses
      const actions = [
        { id: randomUUID(), status: 'pending' },
        { id: randomUUID(), status: 'completed' },
        { id: randomUUID(), status: 'failed' }
      ]

      for (const action of actions) {
        db.prepare(`INSERT INTO browser_actions (id, session_id, action_type, status) VALUES (?, ?, ?, ?)`).run(
          action.id, chatSessionId, 'test', action.status
        )
      }

      const storedActions = db.prepare('SELECT * FROM browser_actions ORDER BY created_at').all() as any[]
      expect(storedActions[0].status).toBe('pending')
      expect(storedActions[1].status).toBe('completed')
      expect(storedActions[2].status).toBe('failed')
    })
  })

  describe('Browser Automation Workflow', () => {
    it('should model complete browser automation workflow', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const chatSessionId = randomUUID()

      // Setup user and workspace
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )

      // Create chat session
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-automation', 'Browser Automation', 'agent:browser-automation:main')

      // Record workflow steps
      const workflow = [
        { type: 'user', content: 'Login to github.com' },
        { type: 'assistant', content: 'Planning browser automation workflow' },
        { type: 'assistant', content: 'Navigating to github.com/login' },
        { type: 'browser_navigate', target: 'https://github.com/login' },
        { type: 'browser_fill', target: 'input[name="login"]', value: 'user@email.com' },
        { type: 'browser_fill', target: 'input[name="password"]', value: 'secretpassword' },
        { type: 'browser_click', target: 'button[type="submit"]' },
        { type: 'assistant', content: 'Successfully logged in' }
      ]

      for (const item of workflow) {
        if (item.type === 'user' || item.type === 'assistant') {
          db.prepare(`INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`).run(
            randomUUID(), chatSessionId, item.type, item.content
          )
        } else {
          db.prepare(`
            INSERT INTO browser_actions (id, session_id, action_type, target, payload, status) VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            randomUUID(), chatSessionId, item.type.replace('browser_', ''), item.target,
            JSON.stringify({ value: (item as any).value }), 'completed'
          )
        }
      }

      // Verify workflow was recorded
      const messages = db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?').get(chatSessionId) as { count: number }
      const actions = db.prepare('SELECT COUNT(*) as count FROM browser_actions WHERE session_id = ?').get(chatSessionId) as { count: number }

      expect(messages.count).toBe(4)
      expect(actions.count).toBe(4)
    })
  })

  describe('Error Handling in Browser Automation', () => {
    it('should record failed browser actions with error details', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const chatSessionId = randomUUID()
      const actionId = randomUUID()

      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-agent', 'Browser Agent', 'agent:browser-agent:main')

      db.prepare(`
        INSERT INTO browser_actions (id, session_id, action_type, target, payload, result, status) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        actionId,
        chatSessionId,
        'click',
        'button#nonexistent',
        JSON.stringify({}),
        JSON.stringify({ error: 'Element not found', timeout: 5000 }),
        'failed'
      )

      const action = db.prepare('SELECT * FROM browser_actions WHERE id = ?').get(actionId) as any
      expect(action.status).toBe('failed')
      expect(JSON.parse(action.result).error).toBe('Element not found')
    })

    it('should allow retry of failed actions', () => {
      const userId = randomUUID()
      const workspaceId = randomUUID()
      const gatewayId = randomUUID()
      const chatSessionId = randomUUID()

      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, 'Test Workspace', userId)
      db.prepare('INSERT INTO gateways (id, workspace_id, name, url, auth_token) VALUES (?, ?, ?, ?, ?)').run(
        gatewayId, workspaceId, 'Test Gateway', 'http://localhost:7777', 'test-token'
      )
      db.prepare(`
        INSERT INTO chat_sessions (id, workspace_id, user_id, gateway_id, agent_id, agent_name, session_key)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(chatSessionId, workspaceId, userId, gatewayId, 'browser-agent', 'Browser Agent', 'agent:browser-agent:main')

      // Create failed action
      const failedActionId = randomUUID()
      db.prepare(`INSERT INTO browser_actions (id, session_id, action_type, target, result, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
        failedActionId, chatSessionId, 'click', 'button#retry', JSON.stringify({ error: 'timeout' }), 'failed'
      )

      // Create retry action
      const retryActionId = randomUUID()
      db.prepare(`INSERT INTO browser_actions (id, session_id, action_type, target, payload, status) VALUES (?, ?, ?, ?, ?, ?)`).run(
        retryActionId, chatSessionId, 'click', 'button#retry', JSON.stringify({ retry: true }), 'completed'
      )

      const failedAction = db.prepare('SELECT status FROM browser_actions WHERE id = ?').get(failedActionId) as any
      const retryAction = db.prepare('SELECT status FROM browser_actions WHERE id = ?').get(retryActionId) as any

      expect(failedAction.status).toBe('failed')
      expect(retryAction.status).toBe('completed')
    })
  })
})
