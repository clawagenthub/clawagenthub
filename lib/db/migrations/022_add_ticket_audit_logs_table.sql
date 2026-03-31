-- Create ticket_audit_logs table for tracking all ticket activity
-- Similar to GitHub Issues/Jira audit timeline

CREATE TABLE IF NOT EXISTS ticket_audit_logs (
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

-- Create index for listing audit logs on a ticket (ordered by creation time)
CREATE INDEX IF NOT EXISTS idx_ticket_audit_logs_ticket_created ON ticket_audit_logs(ticket_id, created_at DESC);

-- Create index for filtering by event type
CREATE INDEX IF NOT EXISTS idx_ticket_audit_logs_event_type ON ticket_audit_logs(event_type);

-- Create index for filtering by actor
CREATE INDEX IF NOT EXISTS idx_ticket_audit_logs_actor ON ticket_audit_logs(actor_id, actor_type);
