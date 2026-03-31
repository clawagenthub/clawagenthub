-- Add flow_mode to tickets to support manual vs automatic flow progression
-- manual: stop at each step (requires explicit start)
-- automatic: continue triggering next statuses until completion/failure

ALTER TABLE tickets
ADD COLUMN flow_mode TEXT DEFAULT 'manual' CHECK(flow_mode IN ('manual', 'automatic'));

CREATE INDEX IF NOT EXISTS idx_tickets_flow_mode ON tickets(flow_mode);
