-- Update flowing_status CHECK constraint to include 'waiting_to_flow'
-- This migration is idempotent - it checks if the update is needed first

-- Check if constraint already includes waiting_to_flow
SELECT 'checking_constraint' WHERE sql LIKE '%waiting_to_flow%'
FROM sqlite_master 
WHERE type = 'table' AND name = 'tickets';

-- If the above returns no rows, we need to update; otherwise skip
-- This is handled by the migration runner checking for the presence of waiting_to_flow in the constraint

BEGIN TRANSACTION;

-- Rename existing table
ALTER TABLE tickets RENAME TO tickets_old;

-- Clean up any invalid flow_mode values in the old table (no constraints apply)
UPDATE tickets_old SET flow_mode = 'manual' WHERE flow_mode NOT IN ('manual', 'automatic') OR flow_mode IS NULL;

-- Clean up any invalid flowing_status values
UPDATE tickets_old SET flowing_status = 'stopped' WHERE flowing_status NOT IN ('stopped', 'flowing', 'waiting', 'failed', 'completed') OR flowing_status IS NULL;

-- Clean up any invalid creation_status values
UPDATE tickets_old SET creation_status = 'draft' WHERE creation_status NOT IN ('draft', 'active') OR creation_status IS NULL;

-- Recreate tickets table with updated CHECK constraint
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  UNIQUE(workspace_id, ticket_number)
);

-- Copy all data from old table
INSERT INTO tickets SELECT * FROM tickets_old;

-- Drop old table
DROP TABLE tickets_old;

-- Recreate indexes
CREATE INDEX idx_tickets_workspace_number ON tickets(workspace_id, ticket_number);
CREATE INDEX idx_tickets_status_id ON tickets(status_id);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_flow_enabled ON tickets(flow_enabled) WHERE flow_enabled = 1;
CREATE INDEX idx_tickets_current_session ON tickets(current_agent_session_id);
CREATE INDEX idx_tickets_flowing_status ON tickets(flowing_status);
CREATE INDEX idx_tickets_flow_mode ON tickets(flow_mode);
CREATE INDEX idx_tickets_creation_status ON tickets(creation_status);

COMMIT;
