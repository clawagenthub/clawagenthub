ALTER TABLE statuses ADD COLUMN end_flow_completed_toggle INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_statuses_end_flow_completed_toggle
  ON statuses(end_flow_completed_toggle);
