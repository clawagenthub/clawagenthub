-- Migration: 034_add_workspace_projects
-- Adds workspace_projects table for project management

BEGIN TRANSACTION;

-- Create temporary check table (idempotency pattern)
CREATE TABLE IF NOT EXISTS _migration_034_check (dummy INTEGER);
DROP TABLE _migration_034_check;

-- Create workspace_projects table
CREATE TABLE workspace_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  value VARCHAR(255),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, name)
);

-- Create indexes
CREATE INDEX idx_workspace_projects_workspace_id ON workspace_projects(workspace_id);
CREATE INDEX idx_workspace_projects_name ON workspace_projects(workspace_id, name);

COMMIT;
