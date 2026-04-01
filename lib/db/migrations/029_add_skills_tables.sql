-- Migration 029: Add Skills Management Tables
-- Creates tables for AI skills and status-skills relationships

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  skill_description TEXT,
  skill_data TEXT NOT NULL,
  source TEXT DEFAULT 'custom',
  external_id TEXT,
  tags TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_skills_workspace ON skills(workspace_id);
CREATE INDEX idx_skills_name ON skills(workspace_id, skill_name);
CREATE INDEX idx_skills_source ON skills(workspace_id, source);
CREATE INDEX idx_skills_active ON skills(workspace_id, is_active);

-- Status-Skills junction table
CREATE TABLE IF NOT EXISTS status_skills (
  id TEXT PRIMARY KEY,
  status_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  UNIQUE(status_id, skill_id)
);

CREATE INDEX idx_status_skills_status ON status_skills(status_id);
CREATE INDEX idx_status_skills_skill ON status_skills(skill_id);
CREATE INDEX idx_status_skills_priority ON status_skills(status_id, priority);
