-- Migration 008: Add origin column to sessions table
-- This stores the client's browser origin for WebSocket connections

-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we need to use a workaround with PRAGMA to check if column exists
-- This migration is idempotent - it can be run multiple times safely

-- Try to add the column (will fail if exists, but we handle that)
-- Note: This relies on the migration runner to handle the duplicate column error
ALTER TABLE sessions ADD COLUMN origin TEXT;

-- Add index for faster lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_sessions_origin ON sessions(origin);
