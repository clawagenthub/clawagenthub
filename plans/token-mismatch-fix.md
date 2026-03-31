# Gateway Token Mismatch - Diagnostic & Fix Plan

## Problem Summary

**Error**: `AUTH_TOKEN_MISMATCH` followed by `AUTH_RATE_LIMITED`

**Root Cause**: The authentication token stored in ClawAgentHub's database doesn't match the token configured in OpenClaw gateway.

**OpenClaw Expected Token**: `YOUR_GATEWAY_TOKEN` (from `.openclaw/openclaw.json`)

---

## Diagnostic Steps

### Step 1: Check Current Gateway Tokens in Database

```bash
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, url, auth_token FROM gateways;"
```

**Expected Output**:
```
gateway-id|Gateway Name|ws://127.0.0.1:18789|[current_token]
```

**What to Look For**:
- Is `auth_token` NULL?
- Is `auth_token` set to a placeholder like `PLEASE_UPDATE_TOKEN`?
- Does `auth_token` match `YOUR_GATEWAY_TOKEN`?

### Step 2: Verify OpenClaw Configuration

```bash
cat .openclaw/openclaw.json | grep -A 5 '"auth"'
```

**Expected Output**:
```json
"auth": {
  "mode": "token",
  "token": "YOUR_GATEWAY_TOKEN"
}
```

✅ **Confirmed**: OpenClaw is configured with token `YOUR_GATEWAY_TOKEN`

### Step 3: Check Rate Limit Status

The rate limit will automatically expire after a few minutes. You can:

**Option A**: Wait 5-10 minutes for rate limit to reset

**Option B**: Restart OpenClaw to clear rate limit immediately
```bash
# Find OpenClaw process
ps aux | grep openclaw

# Restart OpenClaw (method depends on how you're running it)
# If using systemd:
sudo systemctl restart openclaw

# If running manually:
# Stop the process and restart it
```

---

## Fix Steps

### Quick Fix: Update Token in Database

```bash
# 1. List all gateways to find the ID
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name FROM gateways;"

# 2. Update the token (replace YOUR_GATEWAY_ID with actual ID)
sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN', updated_at = datetime('now') WHERE id = 'YOUR_GATEWAY_ID';"

# 3. Verify the update
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, auth_token FROM gateways;"
```

### Alternative: Use Interactive Script

If you have the script available:

```bash
cd githubprojects/clawhub
npm run script scripts/add-gateway-token.ts
```

Follow the prompts to select your gateway and enter token: `YOUR_GATEWAY_TOKEN`

---

## Testing After Fix

### Step 1: Wait for Rate Limit to Clear

**Option A**: Wait 5-10 minutes

**Option B**: Restart OpenClaw gateway
```bash
# This will immediately clear the rate limit
sudo systemctl restart openclaw
# OR restart manually if not using systemd
```

### Step 2: Restart ClawAgentHub Server

```bash
cd githubprojects/clawhub
# Stop current server (Ctrl+C)
npm run dev
```

### Step 3: Test Connection

**Via UI**:
1. Navigate to http://localhost:7777/gateways
2. Click "Connect" on your gateway
3. Check status changes to "connected"

**Via API**:
```bash
# Get your session token from browser cookies
# Then test connection
curl -X POST http://localhost:7777/api/gateways/YOUR_GATEWAY_ID/connect \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN"
```

### Step 4: Verify Logs

Look for these success indicators:

```
[GatewayClient] Initializing with token auth { url: 'ws://127.0.0.1:18789', hasAuthToken: true }
[GatewayClient] Connecting with origin: http://localhost:7777
[GatewayClient] Sending connect request with token auth
[GatewayClient] Successfully authenticated
[GatewayManager] Gateway connected successfully
```

**No more errors like**:
- ❌ `AUTH_TOKEN_MISMATCH`
- ❌ `AUTH_RATE_LIMITED`
- ❌ `unauthorized: gateway token mismatch`

---

## Prevention

### For Future Gateways

When adding new gateways, always include the token:

**Via UI**:
```typescript
// Add gateway form should include:
{
  name: "My Gateway",
  url: "ws://127.0.0.1:18789",
  authToken: "YOUR_GATEWAY_TOKEN"  // ← Always include this
}
```

**Via Database**:
```bash
sqlite3 ~/.clawhub/clawhub.db "INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, created_at, updated_at) VALUES ('new-id', 'workspace-id', 'Gateway Name', 'ws://127.0.0.1:18789', 'YOUR_GATEWAY_TOKEN', 'disconnected', datetime('now'), datetime('now'));"
```

### Token Synchronization

Keep these in sync:
1. **OpenClaw Config**: `.openclaw/openclaw.json` → `gateway.auth.token`
2. **ClawAgentHub Database**: `~/.clawhub/clawhub.db` → `gateways.auth_token`

If you change the token in one place, update it in the other.

---

## Troubleshooting

### Still Getting Token Mismatch After Fix?

**Check for typos**:
```bash
# OpenClaw token
cat .openclaw/openclaw.json | grep -A 3 '"auth"'

# ClawAgentHub token
sqlite3 ~/.clawhub/clawhub.db "SELECT auth_token FROM gateways;"

# Compare them - they must match EXACTLY (case-sensitive)
```

### Rate Limit Not Clearing?

**Force clear by restarting OpenClaw**:
```bash
# Find the process
ps aux | grep openclaw

# Kill it
kill -9 [PID]

# Restart it
openclaw start
```

### Connection Still Fails?

**Check origin is allowed**:
```bash
cat .openclaw/openclaw.json | grep -A 10 '"controlUi"'
```

Ensure `http://localhost:7777` is in `allowedOrigins` array.

✅ **Confirmed**: Already configured correctly in your setup.

---

## Summary

**The Fix**:
```bash
# 1. Update token in database
sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN' WHERE id = 'YOUR_GATEWAY_ID';"

# 2. Wait 5-10 minutes OR restart OpenClaw

# 3. Restart ClawAgentHub
cd githubprojects/clawhub && npm run dev

# 4. Test connection
```

**Expected Result**: Gateway connects successfully without authentication errors.
