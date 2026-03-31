-- Migration 006: Update device identity to use Ed25519 keys
-- This migration updates the gateways table to store proper cryptographic keys
-- instead of simple UUID-based device keys

-- Add new columns for Ed25519 public/private keys
ALTER TABLE gateways ADD COLUMN device_public_key TEXT;
ALTER TABLE gateways ADD COLUMN device_private_key TEXT;

-- Note: device_key column will be kept for backward compatibility
-- but will no longer be used. It can be removed in a future migration
-- after confirming all gateways have been migrated.
