-- Add flowing_status runtime column to tickets table
-- Values: stopped | flowing | waiting | failed | completed

ALTER TABLE tickets
ADD COLUMN flowing_status TEXT DEFAULT 'stopped'
CHECK(flowing_status IN ('stopped', 'flowing', 'waiting', 'failed', 'completed'));

CREATE INDEX IF NOT EXISTS idx_tickets_flowing_status ON tickets(flowing_status);
