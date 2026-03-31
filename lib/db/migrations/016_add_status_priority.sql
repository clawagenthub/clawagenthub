-- Add priority column to statuses table
-- Lower priority numbers appear first on the dashboard (1, 2, 3...)
-- New statuses default to priority 999 (placed at the end)

-- Add priority column with default value
ALTER TABLE statuses ADD COLUMN priority INTEGER DEFAULT 999;

-- Update existing statuses with sensible defaults based on their names
-- 'To Do' = 1, 'In Progress' = 2, 'Done' = 3, others = 999
UPDATE statuses SET priority = CASE 
    WHEN LOWER(name) = 'to do' THEN 1
    WHEN LOWER(name) = 'in progress' THEN 2
    WHEN LOWER(name) = 'done' THEN 3
    ELSE priority
END;

-- Create index for priority-based queries to improve performance
CREATE INDEX IF NOT EXISTS idx_statuses_priority ON statuses(priority);

-- Create a composite index for workspace + priority queries (common for dashboard)
CREATE INDEX IF NOT EXISTS idx_statuses_workspace_priority ON statuses(workspace_id, priority);
