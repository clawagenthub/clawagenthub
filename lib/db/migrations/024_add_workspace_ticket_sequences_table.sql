-- Create workspace_ticket_sequences table for sequential ticket numbering
-- Each workspace maintains its own ticket number sequence

CREATE TABLE IF NOT EXISTS workspace_ticket_sequences (
  workspace_id TEXT PRIMARY KEY,
  next_ticket_number INTEGER DEFAULT 1,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
