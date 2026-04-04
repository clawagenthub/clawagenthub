-- Fix foreign key in ticket_audit_logs that incorrectly referenced tickets_old
-- This was caused by migration 031 that recreated tables but the FK wasn't properly updated

BEGIN TRANSACTION;

-- Disable foreign key checks for this migration
PRAGMA foreign_keys = OFF;

-- Rename existing table
ALTER TABLE ticket_audit_logs RENAME TO ticket_audit_logs_old;

-- Recreate with correct foreign key
CREATE TABLE ticket_audit_logs (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'user',
  old_value TEXT,
  new_value TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Copy data back (only rows with valid ticket_id references)
INSERT INTO ticket_audit_logs SELECT * FROM ticket_audit_logs_old WHERE ticket_id IN (SELECT id FROM tickets);

-- Drop old table
DROP TABLE ticket_audit_logs_old;

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- Recreate indexes
CREATE INDEX idx_ticket_audit_logs_ticket_created ON ticket_audit_logs(ticket_id, created_at DESC);
CREATE INDEX idx_ticket_audit_logs_event_type ON ticket_audit_logs(event_type);
CREATE INDEX idx_ticket_audit_logs_actor ON ticket_audit_logs(actor_id, actor_type);

COMMIT;
