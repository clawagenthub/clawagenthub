-- Add session status tracking fields
ALTER TABLE chat_sessions ADD COLUMN status TEXT DEFAULT 'idle';
ALTER TABLE chat_sessions ADD COLUMN last_activity_at TEXT;
ALTER TABLE chat_sessions ADD COLUMN is_typing INTEGER DEFAULT 0;
ALTER TABLE chat_sessions ADD COLUMN mcp_activity TEXT;
ALTER TABLE chat_sessions ADD COLUMN title TEXT;

-- Update existing sessions with current timestamp
UPDATE chat_sessions SET last_activity_at = updated_at WHERE last_activity_at IS NULL;
