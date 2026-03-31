-- Create statuses table
-- This table stores custom status labels that can be used across the workspace
-- Each workspace has its own set of statuses

CREATE TABLE IF NOT EXISTS statuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  description TEXT,
  workspace_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(name, workspace_id)
);

-- Create index for efficient workspace-based queries
CREATE INDEX IF NOT EXISTS idx_statuses_workspace_id ON statuses(workspace_id);

-- Create index for name searches
CREATE INDEX IF NOT EXISTS idx_statuses_name ON statuses(name);
