-- Fix foreign keys in multiple tables that incorrectly referenced tickets_old
-- This was caused by migration 031 that recreated tables but the FKs weren't properly updated

BEGIN TRANSACTION;

PRAGMA foreign_keys = OFF;

-- Fix ticket_flow_configs
ALTER TABLE ticket_flow_configs RENAME TO ticket_flow_configs_old;
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
INSERT INTO ticket_flow_configs SELECT * FROM ticket_flow_configs_old WHERE ticket_id IN (SELECT id FROM tickets);
DROP TABLE ticket_flow_configs_old;

-- Fix ticket_comments
ALTER TABLE ticket_comments RENAME TO ticket_comments_old;
CREATE TABLE ticket_comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_agent_completion_signal INTEGER DEFAULT 0,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
INSERT INTO ticket_comments SELECT * FROM ticket_comments_old WHERE ticket_id IN (SELECT id FROM tickets);
DROP TABLE ticket_comments_old;

-- Fix ticket_flow_history
ALTER TABLE ticket_flow_history RENAME TO ticket_flow_history_old;
CREATE TABLE ticket_flow_history (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  from_status_id TEXT,
  to_status_id TEXT NOT NULL,
  agent_id TEXT,
  session_id TEXT,
  flow_result TEXT NOT NULL,
  failure_reason TEXT,
  notes TEXT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (from_status_id) REFERENCES statuses(id),
  FOREIGN KEY (to_status_id) REFERENCES statuses(id)
);
INSERT INTO ticket_flow_history SELECT * FROM ticket_flow_history_old WHERE ticket_id IN (SELECT id FROM tickets);
DROP TABLE ticket_flow_history_old;

PRAGMA foreign_keys = ON;

COMMIT;
