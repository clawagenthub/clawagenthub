# Fix: Agent "Cedric" Stuck - Gateway Pairing Required

## Problem Summary

Agent "Cedric" is stuck in "updating" status because the OpenClaw gateway needs to complete **device pairing** with Mission Control.

## Error from Logs

```
OpenClawGatewayError: pairing required
```

This error appears when Mission Control tries to provision the agent but the gateway hasn't completed the device pairing handshake.

## Root Cause

The webhook-worker IS running correctly, but when it tries to provision agent "Cedric", the gateway rejects the connection because:

1. Device pairing is enabled (default and recommended)
2. The gateway hasn't been paired with Mission Control yet
3. Without pairing, the gateway refuses provisioning commands

## Your Gateway Configuration

From [`openclaw.json`](.openclaw/openclaw.json):

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:18789",
        "http://127.0.0.1:18789",
        "http://YOUR_SERVER_HOST:3000"
      ]
    },
    "auth": {
      "mode": "token",
      "token": "YOUR_GATEWAY_TOKEN"
    }
  }
}
```

## Solution: Complete Gateway Pairing

### Step 1: Verify OpenClaw Gateway is Running

Check if your OpenClaw gateway process is running:

```bash
# Check if openclaw is running
ps aux | grep openclaw

# Or check the gateway port
netstat -tuln | grep 18789
# Or on some systems:
ss -tuln | grep 18789
```

If the gateway is NOT running, start it:

```bash
# Start OpenClaw gateway
openclaw gateway start

# Or if you need to run it in the foreground for debugging:
openclaw gateway
```

### Step 2: Access Mission Control Gateway Management

1. Open Mission Control UI: **http://YOUR_SERVER_HOST:3000**
2. Navigate to **Gateways** section (usually in the main menu)
3. Look for existing gateways or click **"Add Gateway"** / **"New Gateway"**

### Step 3: Add/Configure Gateway Connection

When adding or editing the gateway, use these settings:

**Gateway Configuration:**
- **Name**: `clawdbot` (or any descriptive name)
- **URL**: `ws://YOUR_SERVER_HOST:18789` (use your server IP, not localhost if accessing remotely)
- **Token**: `YOUR_GATEWAY_TOKEN` (from your openclaw.json)
- **Workspace Root**: `/root/.openclaw/workspace` (or your preferred path)
- **Device Pairing**: ✅ **ENABLED** (keep this checked - it's the default and recommended)
- **Allow Insecure TLS**: Only if needed for development

### Step 4: Complete Device Pairing Flow

After saving the gateway configuration:

1. Mission Control will attempt to connect to the gateway
2. You should see a **pairing prompt** or **pairing code** in the UI
3. The OpenClaw gateway will also show a pairing request in its logs/output
4. **Approve the pairing** in the OpenClaw gateway:
   - If running in terminal, you may see a prompt to approve
   - Or use: `openclaw gateway pair` command if available
   - Or check the gateway dashboard: `openclaw dashboard`

### Step 5: Verify Gateway Connection

After pairing is complete:

1. In Mission Control UI, the gateway status should show **"Connected"** or **"Online"**
2. Check the gateway connection indicator (usually green/active)

### Step 6: Trigger Agent Re-Provisioning

Now that the gateway is paired:

1. Navigate to **Agents** in Mission Control
2. Find agent **"Cedric"**
3. Click on the agent to view details
4. Click **"Update"** or **"Reprovision"** button
5. The agent should now successfully provision

### Step 7: Monitor Progress

Watch the webhook-worker logs:

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env logs -f webhook-worker
```

You should see:
- ✅ `lifecycle.queue.enqueued` - Task queued
- ✅ `queue.worker.success` - Task processed successfully
- ✅ No more "pairing required" errors
- ✅ Agent status changes to "online"

## Alternative: Disable Device Pairing (NOT RECOMMENDED)

If you absolutely cannot complete device pairing, you can disable it (not recommended for production):

### Option A: Disable in OpenClaw Gateway Config

Edit [`openclaw.json`](.openclaw/openclaw.json):

```json
{
  "gateway": {
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true,
      "allowedOrigins": [
        "http://YOUR_SERVER_HOST:3000"
      ]
    }
  }
}
```

Then restart the gateway:

```bash
openclaw gateway restart
```

### Option B: Disable in Mission Control Gateway Settings

1. In Mission Control, edit the gateway
2. Check **"Disable device pairing"**
3. Save the gateway configuration

**⚠️ Security Warning**: Disabling device pairing removes an important security layer. Only use this for development/testing in trusted networks.

## Troubleshooting

### Gateway Not Responding

**Symptom**: Cannot connect to gateway at `ws://YOUR_SERVER_HOST:18789`

**Solutions**:
```bash
# Check if gateway is running
ps aux | grep openclaw

# Check if port is listening
netstat -tuln | grep 18789

# Check firewall (if applicable)
sudo ufw status
sudo ufw allow 18789/tcp

# Restart gateway
openclaw gateway restart
```

### Pairing Prompt Not Appearing

**Symptom**: No pairing prompt shown in UI or gateway

**Solutions**:
1. Check gateway logs: `openclaw gateway logs` or check terminal output
2. Verify `controlUi.allowedOrigins` includes Mission Control URL
3. Try accessing gateway dashboard: `openclaw dashboard`
4. Check browser console for errors (F12 in browser)

### Gateway Shows "Offline" After Pairing

**Symptom**: Gateway paired but shows offline

**Solutions**:
```bash
# Check gateway health
curl http://YOUR_SERVER_HOST:18789/healthz

# Check WebSocket connection
# In browser console on Mission Control:
# Look for WebSocket connection errors

# Restart gateway
openclaw gateway restart
```

### Agent Still Stuck After Pairing

**Symptom**: Agent remains in "updating" status even after successful pairing

**Solutions**:
1. Manually trigger agent update from Mission Control UI
2. Delete and recreate the agent
3. Check agent workspace directory exists and is writable
4. Review backend logs for other errors:
   ```bash
   cd .openclaw/workspace/openclaw-mission-control
   docker compose -f compose.yml --env-file .env logs backend --tail=100
   ```

## Quick Fix Command Sequence

```bash
# 1. Verify gateway is running
ps aux | grep openclaw

# 2. If not running, start it
openclaw gateway start

# 3. Check gateway is listening
netstat -tuln | grep 18789

# 4. Monitor webhook-worker logs
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env logs -f webhook-worker
```

Then complete pairing in Mission Control UI.

## Verification Checklist

- [ ] OpenClaw gateway is running
- [ ] Gateway port 18789 is accessible
- [ ] Gateway added in Mission Control with correct URL and token
- [ ] Device pairing completed successfully
- [ ] Gateway shows "Connected" status in Mission Control
- [ ] Agent "Cedric" re-provisioning triggered
- [ ] No "pairing required" errors in webhook-worker logs
- [ ] Agent status changes to "online"

## Expected Timeline

After completing pairing and triggering re-provisioning:
- **0-5 seconds**: Lifecycle task queued
- **5-10 seconds**: Gateway provisions agent files
- **10-30 seconds**: Agent starts and sends first heartbeat
- **30 seconds**: Agent status changes to "online"

## Additional Resources

- [OpenClaw Baseline Config](.openclaw/workspace/openclaw-mission-control/docs/openclaw_baseline_config.md) - Lines 478-485 explain device pairing
- [Gateway Agent Provisioning Troubleshooting](.openclaw/workspace/openclaw-mission-control/docs/troubleshooting/gateway-agent-provisioning.md)
- Your OpenClaw config: [`openclaw.json`](.openclaw/openclaw.json)
- Mission Control env: [`.env`](.openclaw/workspace/openclaw-mission-control/.env)

## Summary

The issue is **not** a missing queue worker (it's running fine). The issue is that your OpenClaw gateway requires device pairing before it will accept provisioning commands from Mission Control. Complete the pairing flow in the Mission Control UI, and agent "Cedric" will successfully provision.
