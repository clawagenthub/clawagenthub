-- Gateways table
CREATE TABLE IF NOT EXISTS gateways (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_token TEXT,
  status TEXT DEFAULT 'disconnected',
  last_connected_at DATETIME,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_gateways_workspace_id ON gateways(workspace_id);

-- Gateway pairing requests (temporary storage for pairing flow)
CREATE TABLE IF NOT EXISTS gateway_pairing_requests (
  id TEXT PRIMARY KEY,
  gateway_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE CASCADE
);

CREATE INDEX idx_gateway_pairing_requests_gateway_id ON gateway_pairing_requests(gateway_id);
