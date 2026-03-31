-- Add agent_id column to statuses table
-- This allows statuses to be assigned to specific agents for future features
-- agent_id is nullable - null means the status is not agent-specific (default)

-- Add agent_id column (nullable TEXT)
ALTER TABLE statuses ADD COLUMN agent_id TEXT DEFAULT NULL;

-- Create index for agent-based queries if needed in the future
CREATE INDEX IF NOT EXISTS idx_statuses_agent_id ON statuses(agent_id);
