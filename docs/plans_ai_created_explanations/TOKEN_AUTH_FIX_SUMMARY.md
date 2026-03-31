# OpenClaw Gateway Token Authentication Fix - Implementation Summary

## Date: 2026-03-08

## Problem
ClawAgentHub was unable to connect to OpenClaw gateway with token `YOUR_GATEWAY_TOKEN`, receiving `DEVICE_AUTH_DEVICE_ID_MISMATCH` errors. The issue was that OpenClaw required both token authentication AND device pairing by default, but ClawAgentHub was generating new device identities on each connection attempt.

## Solution Implemented
**Approach A: Token-Only Authentication** - Configured OpenClaw to allow Control UI connections with token-only authentication, bypassing device pairing requirements.

## Changes Made

### 1. OpenClaw Configuration (Already Present)
**File**: [`~/.openclaw/openclaw.json`](/.openclaw/openclaw.json)

The configuration already had `allowInsecureAuth: true` enabled:

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:18789",
        "http://127.0.0.1:18789",
        "http://YOUR_SERVER_HOST:3000"
      ],
      "allowInsecureAuth": true  // ✓ Already configured
    },
    "auth": {
      "mode": "token",
      "token": "YOUR_GATEWAY_TOKEN"
    }
  }
}
```

### 2. OpenClaw Gateway Restart
**Command**: `openclaw gateway restart`

**Result**: Gateway restarted successfully with the new configuration.

### 3. ClawAgentHub Client Updates
**File**: [`githubprojects/clawhub/lib/gateway/client.ts`](githubprojects/clawhub/lib/gateway/client.ts)

#### Change 1: Updated Constructor Comments
- Added clarification that device identity is optional with `allowInsecureAuth`
- Updated logging to indicate token-only auth mode

#### Change 2: Updated Client Identification
Changed from CLI mode to Control UI mode:

```typescript
// Before:
client: {
  id: 'cli',
  platform: 'node',
  mode: 'cli',
}

// After:
client: {
  id: 'control-ui',
  platform: 'web',
  mode: 'control-ui',
}
```

**Why**: OpenClaw's `allowInsecureAuth` setting specifically applies to Control UI clients, not CLI clients.

#### Change 3: Updated Device Payload Signing
Updated the payload format to match Control UI requirements:

```typescript
// Before:
const payloadObj = {
  deviceId: this.deviceId,
  clientId: 'cli',
  clientMode: 'cli',
  platform: 'node',
  // ...
}

// After:
const payloadObj = {
  deviceId: this.deviceId,
  clientId: 'control-ui',
  clientMode: 'control-ui',
  platform: 'web',
  // ...
}
```

## How It Works Now

1. **ClawAgentHub connects** to OpenClaw gateway at `ws://127.0.0.1:18789`
2. **Identifies as Control UI** client (`client.id: 'control-ui'`)
3. **Provides token** in auth payload (`auth: { token: 'YOUR_GATEWAY_TOKEN' }`)
4. **OpenClaw validates token** and skips device pairing (due to `allowInsecureAuth: true`)
5. **Connection succeeds** without requiring device approval

## Device Identity Handling

- Device identity is still generated for compatibility
- Device signature is still included in the connect payload
- **With `allowInsecureAuth: true`**, OpenClaw does NOT validate the device signature
- This allows ClawAgentHub to connect with any device identity as long as the token is correct

## Testing Instructions

1. **Start ClawAgentHub** development server:
   ```bash
   cd githubprojects/clawhub
   npm run dev
   ```

2. **Navigate to Gateways** page in ClawAgentHub UI

3. **Click "Connect with Token"** on your gateway

4. **Enter token**: `YOUR_GATEWAY_TOKEN`

5. **Expected Result**: 
   - Connection succeeds immediately
   - No "device identity mismatch" errors
   - Gateway status shows "connected"
   - No pairing approval required

## Verification Checklist

- [ ] ClawAgentHub can connect to gateway with token
- [ ] No `DEVICE_AUTH_DEVICE_ID_MISMATCH` errors in logs
- [ ] Gateway status shows "connected" in ClawAgentHub UI
- [ ] Can list agents through the connection
- [ ] Connection persists across page refreshes
- [ ] Reconnection works after gateway restart

## Security Considerations

### Current Setup
- **Token-only authentication** - Anyone with the token can connect
- **No per-device access control** - Cannot revoke individual devices
- **Suitable for**: Personal use, development, trusted networks

### Recommendations
1. **Keep token secure** - Don't commit to version control
2. **Use strong tokens** - Consider rotating periodically
3. **Network security** - Use firewall rules to restrict access
4. **For production**: Consider using proper device registration (Approach B)

## Troubleshooting

### Still getting "device identity mismatch"?
1. Verify OpenClaw config has `allowInsecureAuth: true`
2. Confirm OpenClaw gateway was restarted
3. Check ClawAgentHub is sending `client.id: 'control-ui'`
4. Verify token matches exactly

### Connection times out?
1. Check gateway is running: `openclaw gateway status`
2. Verify port 18789 is accessible
3. Check firewall rules
4. Confirm URL is correct

### "Pairing required" error?
- This means `allowInsecureAuth` is not working
- Verify you're connecting from an allowed origin
- Check OpenClaw version supports this feature

## Files Modified

1. [`githubprojects/clawhub/lib/gateway/client.ts`](githubprojects/clawhub/lib/gateway/client.ts)
   - Updated client identification to Control UI mode
   - Updated device payload signing for Control UI
   - Added comments explaining token-only auth

## Files Verified (No Changes Needed)

1. [`~/.openclaw/openclaw.json`](/.openclaw/openclaw.json) - Already had `allowInsecureAuth: true`
2. [`githubprojects/clawhub/lib/gateway/manager.ts`](githubprojects/clawhub/lib/gateway/manager.ts) - No changes needed
3. [`githubprojects/clawhub/app/api/gateways/connect-with-token/route.ts`](githubprojects/clawhub/app/api/gateways/connect-with-token/route.ts) - No changes needed

## Next Steps

1. **Test the connection** using the instructions above
2. **Verify** no errors in browser console or gateway logs
3. **Optional**: Remove device pairing UI if not needed
4. **Optional**: Simplify database schema to remove unused device identity columns

## Alternative Approach (Not Implemented)

**Approach B: Device Registration** would involve:
- Keeping device identity generation
- Registering each device with OpenClaw CLI
- Maintaining device credentials in database
- Following proper pairing workflow

This approach is more secure but more complex. It's recommended for production deployments with multiple users.

## References

- [OpenClaw Gateway Documentation](https://docs.openclaw.ai/gateway)
- [OpenClaw Control UI Configuration](https://docs.openclaw.ai/web/control-ui)
- [Implementation Plan](../plans/fix-openclaw-gateway-token-auth.md)
