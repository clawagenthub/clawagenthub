-- Add first_password_changed field to users table
-- This tracks whether a user has changed their initial password

ALTER TABLE users ADD COLUMN first_password_changed BOOLEAN DEFAULT 0;

-- Update existing users to have first_password_changed = 1
-- (they already have passwords set, so we don't force them to change)
UPDATE users SET first_password_changed = 1;

-- Create index for faster queries on this field
CREATE INDEX idx_users_first_password_changed ON users(first_password_changed);
