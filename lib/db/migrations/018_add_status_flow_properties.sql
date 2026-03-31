-- Add flow control columns to statuses table
-- These columns store DEFAULT values for flow configuration
-- Each ticket can override these defaults via ticket_flow_configs table

-- Add remaining flow properties to statuses
ALTER TABLE statuses ADD COLUMN on_failed_goto TEXT DEFAULT NULL;
-- on_failed_goto: status_id to move to if agent fails (NULL means no special handling)

ALTER TABLE statuses ADD COLUMN is_flow_included INTEGER DEFAULT 1;
-- is_flow_included: boolean (0 or 1) - whether this status is included in default flow

ALTER TABLE statuses ADD COLUMN ask_approve_to_continue INTEGER DEFAULT 0;
-- ask_approve_to_continue: boolean (0 or 1) - whether user must approve before moving to next status

ALTER TABLE statuses ADD COLUMN instructions_override TEXT DEFAULT NULL;
-- instructions_override: markdown content with custom instructions for agents in this status

ALTER TABLE statuses ADD COLUMN is_system_status INTEGER DEFAULT 0;
-- is_system_status: boolean (0 or 1) - reserved for system statuses (idle, online, finished, notinflow)

-- Create index for on_failed_goto lookups
CREATE INDEX IF NOT EXISTS idx_statuses_on_failed_goto ON statuses(on_failed_goto);

-- Create index for filtering system statuses
CREATE INDEX IF NOT EXISTS idx_statuses_is_system_status ON statuses(is_system_status);
