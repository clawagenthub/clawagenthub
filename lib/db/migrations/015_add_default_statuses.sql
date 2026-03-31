-- Seed default statuses for all existing workspaces
-- This migration adds three default statuses to each workspace:
-- - "To Do" (gray) - For items that need to be done
-- - "In Progress" (yellow) - For items currently being worked on
-- - "Done" (green) - For completed items

-- Insert default statuses for all workspaces that don't have any statuses yet
INSERT INTO statuses (id, name, color, description, workspace_id, created_at, updated_at)
SELECT 
  lower(hex(randomblob(16))) as id,
  'To Do' as name,
  '#6B7280' as color,
  'Items that need to be done' as description,
  w.id as workspace_id,
  datetime('now') as created_at,
  datetime('now') as updated_at
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM statuses s WHERE s.workspace_id = w.id
);

INSERT INTO statuses (id, name, color, description, workspace_id, created_at, updated_at)
SELECT 
  lower(hex(randomblob(16))) as id,
  'In Progress' as name,
  '#F59E0B' as color,
  'Items currently being worked on' as description,
  w.id as workspace_id,
  datetime('now') as created_at,
  datetime('now') as updated_at
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM statuses s WHERE s.workspace_id = w.id AND s.name = 'In Progress'
);

INSERT INTO statuses (id, name, color, description, workspace_id, created_at, updated_at)
SELECT 
  lower(hex(randomblob(16))) as id,
  'Done' as name,
  '#10B981' as color,
  'Completed items' as description,
  w.id as workspace_id,
  datetime('now') as created_at,
  datetime('now') as updated_at
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM statuses s WHERE s.workspace_id = w.id AND s.name = 'Done'
);
