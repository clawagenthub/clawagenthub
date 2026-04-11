-- Migration: 035_add_project_id_to_tickets.sql
-- Add project_id column to tickets table for project-ticket association

-- Add project_id column if it doesn't exist
ALTER TABLE tickets ADD COLUMN project_id TEXT;

-- Add foreign key constraint if not exists
-- Note: SQLite doesn't support ADD CONSTRAINT with CHECK in ALTER TABLE,
-- so we add a comment for documentation purposes

-- Create index for faster lookups by project
CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id);

-- Insert migration record
INSERT OR IGNORE INTO migrations (name) VALUES ('035_add_project_id_to_tickets.sql');