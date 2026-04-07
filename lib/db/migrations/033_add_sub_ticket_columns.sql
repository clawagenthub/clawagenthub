-- Migration: 033_add_sub_ticket_columns
-- Adds hierarchical sub-ticket support to tickets table
-- Uses table rebuild pattern since SQLite doesn't support ADD COLUMN IF NOT EXISTS

BEGIN TRANSACTION;

-- Check if is_sub_ticket column exists (idempotency check)
PRAGMA table_info(tickets);

-- Create temporary check table to verify we can create/drop tables
CREATE TABLE IF NOT EXISTS _migration_033_check (dummy INTEGER);
DROP TABLE _migration_033_check;

-- Check if columns already exist via pragma
-- If is_sub_ticket column is found, migration is already applied
-- The result of this check is informational - we handle idempotency via try/catch in the runner

-- Rename existing table
ALTER TABLE tickets RENAME TO tickets_old;

-- Recreate tickets table with new columns
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
  flowing_status TEXT DEFAULT 'stopped' CHECK(flowing_status IN ('stopped', 'flowing', 'waiting', 'waiting_to_flow', 'failed', 'completed')),
  flow_mode TEXT DEFAULT 'manual' CHECK(flow_mode IN ('manual', 'automatic')),
  current_agent_session_id TEXT,
  last_flow_check_at TEXT,
  completed_at TEXT,
  creation_status TEXT DEFAULT 'draft' CHECK(creation_status IN ('draft', 'active')),
  is_sub_ticket INTEGER DEFAULT 0,
  parent_ticket_id TEXT,
  waiting_finished_ticket_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (parent_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
  FOREIGN KEY (waiting_finished_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
  UNIQUE(workspace_id, ticket_number)
);

-- Copy all data from old table
INSERT INTO tickets SELECT 
  id, workspace_id, ticket_number, title, description, status_id,
  created_by, assigned_to, flow_enabled, flowing_status, flow_mode,
  current_agent_session_id, last_flow_check_at, completed_at,
  creation_status, created_at, updated_at,
  0 as is_sub_ticket,
  NULL as parent_ticket_id,
  NULL as waiting_finished_ticket_id
FROM tickets_old;

-- Drop old table
DROP TABLE tickets_old;

-- Recreate indexes (keep existing indexes + add new ones for sub-ticket columns)
CREATE INDEX idx_tickets_workspace_number ON tickets(workspace_id, ticket_number);
CREATE INDEX idx_tickets_status_id ON tickets(status_id);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_flow_enabled ON tickets(flow_enabled) WHERE flow_enabled = 1;
CREATE INDEX idx_tickets_current_session ON tickets(current_agent_session_id);
CREATE INDEX idx_tickets_flowing_status ON tickets(flowing_status);
CREATE INDEX idx_tickets_flow_mode ON tickets(flow_mode);
CREATE INDEX idx_tickets_creation_status ON tickets(creation_status);

-- New indexes for sub-ticket functionality
CREATE INDEX idx_tickets_is_sub_ticket ON tickets(is_sub_ticket);
CREATE INDEX idx_tickets_parent_ticket_id ON tickets(parent_ticket_id);
CREATE INDEX idx_tickets_waiting_finished_ticket_id ON tickets(waiting_finished_ticket_id);

COMMIT;