-- Migration 013: Add user_settings table for chat summarizer preferences
-- Created: 2026-03-10

CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  summarizer_agent_id TEXT,
  summarizer_gateway_id TEXT,
  auto_summary_enabled INTEGER NOT NULL DEFAULT 1,
  idle_timeout_minutes INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
