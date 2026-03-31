-- Create tickets table for the ticket/workflow management system
-- Each ticket belongs to a workspace and has a sequential number

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  ticket_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  assigned_to TEXT,
  flow_enabled INTEGER DEFAULT 1,
  current_agent_session_id TEXT,
  last_flow_check_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  UNIQUE(workspace_id, ticket_number)
);

-- Create index for workspace-based ticket listing
CREATE INDEX IF NOT EXISTS idx_tickets_workspace_number ON tickets(workspace_id, ticket_number);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);

-- Create index for created_by filtering (my tickets)
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);

-- Create index for assigned_to filtering (assigned to me)
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);

-- Create index for flow processing (find active flow tickets)
CREATE INDEX IF NOT EXISTS idx_tickets_flow_enabled ON tickets(flow_enabled) WHERE flow_enabled = 1;

-- Create index for active agent session lookups
CREATE INDEX IF NOT EXISTS idx_tickets_current_session ON tickets(current_agent_session_id);
