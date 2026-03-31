-- Workspace settings table (key-value store per workspace)
-- This table stores workspace-level settings like custom flow prompt templates
CREATE TABLE IF NOT EXISTS workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, setting_key)
);

-- Index for efficient lookups by workspace
CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id ON workspace_settings(workspace_id);

-- Index for efficient lookups by workspace and key
CREATE INDEX IF NOT EXISTS idx_workspace_settings_key ON workspace_settings(workspace_id, setting_key);
