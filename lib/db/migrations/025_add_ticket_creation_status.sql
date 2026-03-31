-- Add creation_status column to tickets table
-- This column tracks whether a ticket is a draft or active (published)

-- Add the column with default value 'active'
ALTER TABLE tickets ADD COLUMN creation_status TEXT DEFAULT 'active' CHECK(creation_status IN ('draft', 'active'));

-- Create index for filtering by creation_status
CREATE INDEX IF NOT EXISTS idx_tickets_creation_status ON tickets(creation_status);
