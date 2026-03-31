-- Create ticket_comments table for ticket comments and discussions
-- Comments support markdown content and agent completion signals

CREATE TABLE IF NOT EXISTS ticket_comments (
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

-- Create index for listing comments on a ticket (ordered by creation time)
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_created ON ticket_comments(ticket_id, created_at DESC);

-- Create index for finding completion signals
CREATE INDEX IF NOT EXISTS idx_ticket_comments_completion_signal ON ticket_comments(ticket_id, is_agent_completion_signal) WHERE is_agent_completion_signal = 1;
