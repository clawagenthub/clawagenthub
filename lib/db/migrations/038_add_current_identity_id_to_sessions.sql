ALTER TABLE sessions ADD COLUMN current_identity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_current_identity_id
  ON sessions(current_identity_id);
