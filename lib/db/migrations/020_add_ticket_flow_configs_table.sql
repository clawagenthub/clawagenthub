-- Create ticket_flow_configs table for ticket-specific flow configuration
-- Each ticket can customize its flow independently from workspace defaults

CREATE TABLE IF NOT EXISTS ticket_flow_configs (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  status_id TEXT NOT NULL,
  flow_order INTEGER NOT NULL,
  agent_id TEXT,
  on_failed_goto TEXT,
  ask_approve_to_continue INTEGER DEFAULT 0,
  instructions_override TEXT,
  is_included INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  UNIQUE(ticket_id, status_id)
);

-- Create index for getting a ticket's flow configs (ordered)
CREATE INDEX IF NOT EXISTS idx_ticket_flow_configs_ticket_order ON ticket_flow_configs(ticket_id, flow_order);

-- Create index for reverse lookup (which tickets use a status)
CREATE INDEX IF NOT EXISTS idx_ticket_flow_configs_status_id ON ticket_flow_configs(status_id);

-- Create index for finding included statuses in flow
CREATE INDEX IF NOT EXISTS idx_ticket_flow_configs_included ON ticket_flow_configs(ticket_id, is_included) WHERE is_included = 1;
