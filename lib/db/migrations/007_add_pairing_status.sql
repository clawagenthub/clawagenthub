-- Add pairing_status column to gateways table
ALTER TABLE gateways ADD COLUMN pairing_status TEXT DEFAULT 'not_started';

-- Update existing gateways based on whether they have a token
UPDATE gateways 
SET pairing_status = CASE 
  WHEN auth_token IS NOT NULL THEN 'approved'
  ELSE 'not_started'
END;
