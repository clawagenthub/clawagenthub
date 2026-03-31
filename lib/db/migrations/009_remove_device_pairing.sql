-- Migration 009: Remove Device Pairing System
-- This migration removes all device identity and pairing-related columns
-- and simplifies the gateway table to use only token-based authentication

-- Step 1: Create a backup table with the new schema
CREATE TABLE gateways_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_connected_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table to new table
-- Set a placeholder token for gateways without one
INSERT INTO gateways_new (
  id,
  workspace_id,
  name,
  url,
  auth_token,
  status,
  last_connected_at,
  last_error,
  created_at,
  updated_at
)
SELECT 
  id,
  workspace_id,
  name,
  url,
  COALESCE(auth_token, 'PLEASE_UPDATE_TOKEN'),
  status,
  last_connected_at,
  last_error,
  created_at,
  updated_at
FROM gateways;

-- Step 3: Drop the old table
DROP TABLE gateways;

-- Step 4: Rename the new table
ALTER TABLE gateways_new RENAME TO gateways;

-- Step 5: Create indexes for performance
CREATE INDEX idx_gateways_workspace_id ON gateways(workspace_id);
CREATE INDEX idx_gateways_status ON gateways(status);
