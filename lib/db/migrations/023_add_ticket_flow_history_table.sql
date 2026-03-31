-- Create ticket_flow_history table for tracking flow transitions
-- Records each step in the ticket's flow journey

CREATE TABLE IF NOT EXISTS ticket_flow_history (
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

-- Create index for listing flow history on a ticket (ordered by creation time)
CREATE INDEX IF NOT EXISTS idx_ticket_flow_history_ticket_created ON ticket_flow_history(ticket_id, created_at DESC);

-- Create index for filtering by result
CREATE INDEX IF NOT EXISTS idx_ticket_flow_history_result ON ticket_flow_history(flow_result);

-- Create index for filtering by agent
CREATE INDEX IF NOT EXISTS idx_ticket_flow_history_agent ON ticket_flow_history(agent_id);
