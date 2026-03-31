-- Add device identity fields to gateways table
ALTER TABLE gateways ADD COLUMN device_id TEXT;
ALTER TABLE gateways ADD COLUMN device_key TEXT;
