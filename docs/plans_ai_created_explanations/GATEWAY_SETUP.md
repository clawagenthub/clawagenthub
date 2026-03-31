# Gateway Setup Guide

This guide explains how to connect ClawAgentHub to your OpenClaw Gateway to access your AI agents.

## Quick Start

### Option 1: Web UI (Recommended)

1. Navigate to `/gateways/setup` in ClawAgentHub
2. The page will automatically try to discover your local gateway
3. Enter your auth token when prompted
4. Click "Connect Gateway"

### Option 2: Command Line Script

```bash
# Find your workspace ID
sqlite3 data/clawhub.db "SELECT id, name FROM workspaces;"

# Run the setup script
node scripts/setup-gateway.js <workspace-id> <auth-token>

# Example:
node scripts/setup-gateway.js abc-123-def YOUR_GATEWAY_TOKEN
```

### Option 3: Manual SQL

```sql
-- Connect to database
sqlite3 data/clawhub.db

-- Find your workspace ID
SELECT id, name FROM workspaces;

-- Insert gateway (replace values)
INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, last_connected_at, created_at, updated_at)
VALUES (
  'local-gateway-001',
  '<your-workspace-id>',
  'Local OpenClaw Gateway',
  'ws://localhost:18789',
  '<your-auth-token>',
  'connected',
  datetime('now'),
  datetime('now'),
  datetime('now')
);
```

## Finding Your Auth Token

Your OpenClaw Gateway auth token is in `~/.openclaw/openclaw.json`:

```bash
# View the auth section
cat ~/.openclaw/openclaw.json | grep -A 2 '"auth"'

# Or open the file
cat ~/.openclaw/openclaw.json
```

Look for:
```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "your-token-here"
    }
  }
}
```

## Prerequisites

1. **OpenClaw Gateway must be running:**
   ```bash
   openclaw gateway
   ```

2. **Check gateway status:**
   ```bash
   openclaw status
   ```

3. **Verify agents are configured:**
   ```bash
   openclaw agents list
   ```

## Troubleshooting

### No agents appearing after gateway connection

1. **Check gateway is running:**
   ```bash
   openclaw status
   ```

2. **Verify agents exist:**
   ```bash
   openclaw agents list
   ```

3. **Check gateway connection in database:**
   ```sql
   SELECT * FROM gateways;
   ```

4. **Test WebSocket connection manually:**
   ```bash
   # Install wscat if needed
   npm install -g wscat
   
   # Connect to gateway
   wscat -c ws://localhost:18789
   ```

### Connection refused errors

- Make sure OpenClaw Gateway is running on port 18789
- Check if another process is using the port:
  ```bash
  lsof -i :18789
  ```

### Authentication errors

- Verify your auth token matches the one in `~/.openclaw/openclaw.json`
- Check CORS settings in OpenClaw config:
  ```json
  {
    "gateway": {
      "controlUi": {
        "allowedOrigins": [
          "http://localhost:3000",
          "http://127.0.0.1:3000"
        ]
      }
    }
  }
  ```

### Gateway shows as disconnected

1. **Check gateway status in database:**
   ```sql
   SELECT id, name, url, status, last_error FROM gateways;
   ```

2. **Update gateway status:**
   ```sql
   UPDATE gateways 
   SET status = 'connected', 
       last_connected_at = datetime('now')
   WHERE id = '<gateway-id>';
   ```

3. **Restart ClawAgentHub server** to re-establish connections

## API Endpoints

### List Gateways
```
GET /api/gateways
```

Returns all gateways for the current workspace.

### Add Gateway
```
POST /api/gateways
Content-Type: application/json

{
  "name": "My Gateway",
  "url": "ws://localhost:18789",
  "authToken": "your-token"
}
```

### Auto-Discover Gateway
```
POST /api/gateways/discover
Content-Type: application/json

{
  "authToken": "optional-token",
  "customUrl": "optional-custom-url"
}
```

### Delete Gateway
```
DELETE /api/gateways?id=<gateway-id>
```

## Architecture

```
ClawAgentHub Web App
    ↓
/api/chat/agents endpoint
    ↓
Database: gateways table
    ↓
GatewayClient (WebSocket)
    ↓
OpenClaw Gateway (ws://localhost:18789)
    ↓
agents.list RPC method
    ↓
Returns list of configured agents
```

## Configuration Files

### ClawAgentHub Database Schema
```sql
CREATE TABLE gateways (
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
```

### OpenClaw Gateway Config
Location: `~/.openclaw/openclaw.json`

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "your-token-here"
    },
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
      ]
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "name": "Main Agent"
      }
    ]
  }
}
```

## Security Notes

1. **Auth tokens are stored in the database** - Make sure your database is secure
2. **WebSocket connections use the auth token** for authentication
3. **CORS origins must be configured** in OpenClaw Gateway
4. **Use wss:// (secure WebSocket)** in production environments
5. **Never commit auth tokens** to version control

## Next Steps

After connecting your gateway:

1. Go to `/chat` in ClawAgentHub
2. Select an agent from the dropdown
3. Start chatting!

## Related Documentation

- [OpenClaw Gateway Protocol](https://docs.openclaw.ai/gateway/protocol)
- [OpenClaw Configuration](https://docs.openclaw.ai/config)
- [ClawAgentHub Chat Architecture](../plans/chat-feature-architecture.md)
- [Agents List Diagnosis](../plans/agents-list-empty-diagnosis.md)
