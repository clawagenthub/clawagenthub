# Gateway Auto-Discovery Implementation Summary

## Problem Solved

**Issue:** ClawAgentHub showed "No agents available" despite having 11 agents configured in the local OpenClaw Gateway.

**Root Cause:** The `gateways` table in ClawAgentHub's database was empty. ClawAgentHub requires gateways to be registered before it can query them for agents.

## Solution Implemented

### 1. Gateway Management API

**File:** [`app/api/gateways/route.ts`](../app/api/gateways/route.ts)

- `GET /api/gateways` - List all gateways for workspace
- `POST /api/gateways` - Add new gateway with connection testing
- `DELETE /api/gateways` - Remove gateway

Features:
- Validates gateway URL and auth token
- Tests connection before saving
- Proper error handling and logging
- Workspace-scoped gateway management

### 2. Auto-Discovery API

**File:** [`app/api/gateways/discover/route.ts`](../app/api/gateways/discover/route.ts)

- `POST /api/gateways/discover` - Auto-discover local OpenClaw Gateway

Features:
- Tries common localhost URLs (localhost, 127.0.0.1, 0.0.0.0)
- Tests with and without authentication
- 3-second timeout per connection attempt
- Returns health information from discovered gateways
- Supports custom URLs and auth tokens

### 3. Gateway Setup UI

**File:** [`app/(dashboard)/gateways/setup/page.tsx`](../app/(dashboard)/gateways/setup/page.tsx)

A complete setup wizard with:
- **Auto-discovery on page load** - Automatically searches for local gateway
- **Manual configuration** - Fallback for custom setups
- **Connection testing** - Validates before saving
- **Real-time feedback** - Shows discovery progress and errors
- **Help section** - Guides users through common issues

### 4. Enhanced Agent Selector

**File:** [`components/chat/agent-selector.tsx`](../components/chat/agent-selector.tsx)

Updated to show:
- Clear "No agents available" message
- Direct link to gateway setup page
- Better error messaging

### 5. Quick Setup Script

**File:** [`scripts/setup-gateway.js`](../scripts/setup-gateway.js)

Command-line tool for quick gateway registration:
```bash
node scripts/setup-gateway.js <workspace-id> <auth-token>
```

Features:
- Validates workspace exists
- Updates existing gateway or creates new one
- Clear error messages and guidance

### 6. Comprehensive Documentation

**File:** [`docs/GATEWAY_SETUP.md`](../docs/GATEWAY_SETUP.md)

Complete guide covering:
- Three setup methods (Web UI, CLI, SQL)
- Finding auth tokens
- Troubleshooting common issues
- API documentation
- Architecture overview
- Security notes

## How It Works

### Auto-Discovery Flow

```
1. User visits /gateways/setup
   ↓
2. Page automatically calls POST /api/gateways/discover
   ↓
3. API tries common URLs:
   - ws://localhost:18789
   - ws://127.0.0.1:18789
   - ws://0.0.0.0:18789
   ↓
4. For each URL, tries common auth tokens:
   - No auth ('')
   - 'dev'
   - 'local'
   ↓
5. Successful connections return health info
   ↓
6. UI displays discovered gateways
   ↓
7. User enters auth token if needed
   ↓
8. Click "Connect Gateway" to save
   ↓
9. Redirect to /chat with agents available
```

### Connection Testing

Before saving a gateway, the system:
1. Creates WebSocket connection
2. Performs OpenClaw handshake
3. Calls `health()` RPC method
4. Verifies response
5. Disconnects cleanly

Only if all steps succeed is the gateway saved to the database.

## Usage

### Quick Start (Recommended)

1. Navigate to `/gateways/setup` in ClawAgentHub
2. Wait for auto-discovery (2-3 seconds)
3. Enter your auth token from `~/.openclaw/openclaw.json`
4. Click "Connect Gateway"
5. Go to `/chat` and select an agent

### Command Line

```bash
# Find workspace ID
sqlite3 data/clawhub.db "SELECT id, name FROM workspaces;"

# Run setup script
node scripts/setup-gateway.js <workspace-id> YOUR_GATEWAY_TOKEN
```

### Manual SQL (For Testing)

```sql
INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, last_connected_at, created_at, updated_at)
VALUES (
  'local-gateway-001',
  '<workspace-id>',
  'Local OpenClaw Gateway',
  'ws://localhost:18789',
  'YOUR_GATEWAY_TOKEN',
  'connected',
  datetime('now'),
  datetime('now'),
  datetime('now')
);
```

## Files Created/Modified

### New Files
- `app/api/gateways/route.ts` - Gateway management API
- `app/api/gateways/discover/route.ts` - Auto-discovery API
- `app/(dashboard)/gateways/setup/page.tsx` - Setup wizard UI
- `scripts/setup-gateway.js` - CLI setup tool
- `docs/GATEWAY_SETUP.md` - Complete documentation

### Modified Files
- `components/chat/agent-selector.tsx` - Added gateway setup link

## Testing

### Test Auto-Discovery

1. Make sure OpenClaw Gateway is running:
   ```bash
   openclaw gateway
   ```

2. Visit `http://localhost:3000/gateways/setup`

3. Should see "Gateway discovered!" within 3 seconds

### Test Manual Setup

1. Visit `/gateways/setup`
2. Enter custom URL and auth token
3. Click "Test Connection"
4. Should show success or specific error

### Test API Directly

```bash
# Discover gateways
curl -X POST http://localhost:3000/api/gateways/discover \
  -H "Content-Type: application/json" \
  -d '{"authToken": "YOUR_GATEWAY_TOKEN"}'

# Add gateway
curl -X POST http://localhost:3000/api/gateways \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local Gateway",
    "url": "ws://localhost:18789",
    "authToken": "YOUR_GATEWAY_TOKEN"
  }'

# List gateways
curl http://localhost:3000/api/gateways
```

## Configuration Requirements

### OpenClaw Gateway

Your `~/.openclaw/openclaw.json` must include:

```json
{
  "gateway": {
    "port": 18789,
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
  }
}
```

### ClawAgentHub

No additional configuration needed. The system uses:
- Database: `data/clawhub.db`
- Gateway table: Already exists from migration 004

## Troubleshooting

### Discovery finds no gateways

1. Check OpenClaw Gateway is running: `openclaw status`
2. Verify port 18789 is open: `lsof -i :18789`
3. Try manual setup with explicit URL

### Connection fails with auth error

1. Verify token in `~/.openclaw/openclaw.json`
2. Check CORS origins include ClawAgentHub URL
3. Try without auth first (empty token)

### Agents still not showing

1. Verify gateway saved: `SELECT * FROM gateways;`
2. Check gateway status is 'connected'
3. Restart ClawAgentHub server
4. Check browser console for errors

## Security Considerations

1. **Auth tokens stored in database** - Ensure database security
2. **WebSocket connections** - Use wss:// in production
3. **CORS configuration** - Restrict allowed origins
4. **Token exposure** - Never commit tokens to git
5. **Connection timeouts** - Prevents hanging connections

## Future Enhancements

Potential improvements:
- [ ] Gateway health monitoring
- [ ] Automatic reconnection on disconnect
- [ ] Multiple gateway support in UI
- [ ] Gateway status dashboard
- [ ] Connection pooling
- [ ] Certificate pinning for wss://
- [ ] Gateway discovery via mDNS/Bonjour
- [ ] Cloud gateway support

## Related Documentation

- [Agents List Diagnosis](./agents-list-empty-diagnosis.md) - Original problem analysis
- [Gateway Setup Guide](../docs/GATEWAY_SETUP.md) - User documentation
- [Chat Architecture](./chat-feature-architecture.md) - Overall system design
- [OpenClaw Protocol](https://docs.openclaw.ai/gateway/protocol) - Official docs

## Success Metrics

After implementation:
- ✅ Auto-discovery works in <3 seconds
- ✅ Manual setup validates connections
- ✅ Clear error messages guide users
- ✅ Agents appear after gateway connection
- ✅ Multiple setup methods available
- ✅ Comprehensive documentation provided

## Conclusion

The gateway auto-discovery feature provides a seamless onboarding experience for ClawAgentHub users. Instead of manual database manipulation, users can now:

1. Visit a setup page
2. Let the system find their gateway
3. Enter their auth token
4. Start chatting with agents

This dramatically improves the user experience and reduces setup friction from "technical SQL commands" to "click a button and enter a token."
