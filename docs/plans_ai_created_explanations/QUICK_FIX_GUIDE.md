# Quick Fix: OpenClaw Origin Error - 5 Minute Solution

## The Problem

You're seeing this error when ClawAgentHub tries to connect to OpenClaw:
```
origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)
```

## Root Cause

**Node.js WebSocket clients don't send Origin headers by default.** The OpenClaw gateway expects an Origin header and rejects connections without one.

## Quick Fix Options (Choose One)

### Option 1: Add Origin Header to WebSocket (5 minutes) ⭐ RECOMMENDED

This is the proper fix that works in all scenarios.

**Step 1:** Edit `githubprojects/clawhub/lib/gateway/client.ts`

Find the `connect()` method around line 200 and change:

```typescript
// BEFORE (line ~200)
this.ws = new WebSocket(this.url, {
  maxPayload: 25 * 1024 * 1024,
})
```

To:

```typescript
// AFTER
const origin = this.determineOrigin()
console.log('[GatewayClient] Connecting with origin:', origin)

this.ws = new WebSocket(this.url, {
  maxPayload: 25 * 1024 * 1024,
  headers: {
    'Origin': origin
  }
})
```

**Step 2:** Add the `determineOrigin()` method to the `GatewayClient` class:

```typescript
private determineOrigin(): string {
  // Use environment variable if set
  if (process.env.CLAWHUB_ORIGIN) {
    return process.env.CLAWHUB_ORIGIN
  }
  
  // Parse gateway URL to construct matching origin
  const gatewayUrl = new URL(this.url)
  const protocol = gatewayUrl.protocol === 'wss:' ? 'https:' : 'http:'
  
  // If connecting to localhost, use localhost origin
  if (gatewayUrl.hostname === 'localhost' || gatewayUrl.hostname === '127.0.0.1') {
    return `${protocol}//localhost:18789`
  }
  
  // For remote connections, use the gateway host
  return `${protocol}//${gatewayUrl.host}`
}
```

**Step 3:** Restart your ClawAgentHub dev server:

```bash
cd githubprojects/clawhub
npm run dev
```

**Step 4:** Test the connection!

---

### Option 2: Use Localhost (1 minute) 🚀 FASTEST

If ClawAgentHub and OpenClaw are on the same machine:

**Just access ClawAgentHub via localhost instead of IP:**
- Instead of: `http://YOUR_SERVER_HOST:7777`
- Use: `http://localhost:7777`

The localhost origin is already in your OpenClaw config and should work immediately.

---

### Option 3: Restart OpenClaw Gateway (2 minutes)

Your config already has the right origins, but the gateway might not have loaded them.

```bash
# Restart the gateway
openclaw gateway restart

# Verify it's running
openclaw gateway status

# Check the config was loaded
openclaw config get gateway.controlUi.allowedOrigins
```

Then try connecting from ClawAgentHub again.

---

### Option 4: Temporary Disable Origin Check (30 seconds) ⚠️ DEV ONLY

**WARNING: Only for local development testing!**

**Step 1:** Edit `~/.openclaw/openclaw.json`

Find the `gateway.controlUi` section and add:

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [...],
      "allowInsecureAuth": true,
      "dangerouslyAllowHostHeaderOriginFallback": true,
      "dangerouslyDisableOriginCheck": true  // ⚠️ Add this line
    }
  }
}
```

**Step 2:** Restart gateway:

```bash
openclaw gateway restart
```

**Step 3:** Test connection from ClawAgentHub

**Step 4:** REMOVE this setting after testing!

---

## Verification Steps

After applying any fix:

1. **Check ClawAgentHub logs** for connection attempts:
   ```bash
   # In ClawAgentHub terminal, you should see:
   [GatewayClient] Connecting with origin: http://YOUR_SERVER_HOST:7777
   [GatewayClient] WebSocket connection opened
   ```

2. **Check OpenClaw gateway logs**:
   ```bash
   openclaw gateway logs --follow
   ```
   Look for successful connection messages, not "origin not allowed" errors.

3. **Test in ClawAgentHub UI**:
   - Go to gateway management page
   - Try to connect to a gateway
   - Should see "Connected" status

## Still Not Working?

### Debug Checklist

- [ ] OpenClaw gateway is running: `openclaw gateway status`
- [ ] Port 18789 is accessible: `curl http://localhost:18789/health`
- [ ] Your origin is in the config: `openclaw config get gateway.controlUi.allowedOrigins`
- [ ] Gateway was restarted after config changes
- [ ] ClawAgentHub dev server was restarted after code changes
- [ ] No firewall blocking port 18789

### Get More Info

```bash
# Check gateway status
openclaw gateway status

# View full config
openclaw config get gateway

# Check for errors
openclaw gateway logs | grep -i error

# Run diagnostics
openclaw doctor
```

### Common Issues

**Issue:** "ECONNREFUSED"
- **Fix:** Gateway isn't running. Start it: `openclaw gateway start`

**Issue:** "Device identity mismatch"
- **Fix:** Different issue. See [`OPENCLAW_GATEWAY_CONNECTION_ANALYSIS.md`](./OPENCLAW_GATEWAY_CONNECTION_ANALYSIS.md)

**Issue:** "Unauthorized" or "token mismatch"
- **Fix:** Check your gateway token matches in both ClawAgentHub and OpenClaw config

## Next Steps

After fixing the origin issue:

1. ✅ Test connection from ClawAgentHub
2. 📝 Document your setup for team members
3. 🔒 Review security settings for production
4. 🐛 Fix any remaining device identity issues (see other doc)

## Need More Help?

- Full documentation: [`ORIGIN_NOT_ALLOWED_FIX.md`](./ORIGIN_NOT_ALLOWED_FIX.md)
- Device identity issues: [`OPENCLAW_GATEWAY_CONNECTION_ANALYSIS.md`](./OPENCLAW_GATEWAY_CONNECTION_ANALYSIS.md)
- OpenClaw docs: https://docs.openclaw.ai/gateway/troubleshooting
