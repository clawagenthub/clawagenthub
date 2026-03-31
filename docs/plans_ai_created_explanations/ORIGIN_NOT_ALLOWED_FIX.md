# OpenClaw Gateway "Origin Not Allowed" Error - Complete Fix Guide

## Problem Summary

**Error Message:**
```
origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)
```

**What's Happening:**
- ClawAgentHub (running on port 7777) tries to connect to OpenClaw gateway via WebSocket
- The WebSocket connection is rejected due to origin validation failure
- Even though `http://YOUR_SERVER_HOST:7777` is in the `allowedOrigins` config

## Root Cause Analysis

### Issue 1: Node.js WebSocket Client Doesn't Send Origin Header by Default

The `ws` library in Node.js **does not automatically send an Origin header** unless explicitly configured. This is different from browser WebSocket connections.

**Current Code** ([`lib/gateway/client.ts:200`](../lib/gateway/client.ts)):
```typescript
this.ws = new WebSocket(this.url, {
  maxPayload: 25 * 1024 * 1024,
  // ❌ No origin header - gateway sees undefined origin
})
```

### Issue 2: Gateway Origin Check Logic

From OpenClaw source code analysis:
- When a WebSocket connection arrives, the gateway checks the `Origin` header
- If no Origin header is present, it may use the `Host` header as fallback (if `dangerouslyAllowHostHeaderOriginFallback` is enabled)
- If the origin doesn't match `allowedOrigins`, connection is rejected

### Issue 3: Server-Side vs Browser-Side WebSocket

Your ClawAgentHub has two connection scenarios:

1. **Server-side (Node.js API routes)** - No automatic Origin header
2. **Browser-side (if you add client-side connection)** - Automatic Origin header

## Solution Options

### Option 1: Add Origin Header to WebSocket Client (Recommended)

Modify the WebSocket client to explicitly send the Origin header.

**Pros:**
- Proper security boundary
- Works with strict origin validation
- Follows web standards

**Cons:**
- Requires code changes
- Need to know the correct origin at runtime

### Option 2: Use Gateway's Insecure Auth Mode (Already Enabled)

You already have `allowInsecureAuth: true` in your config, but this only works for localhost connections.

**Pros:**
- No code changes needed
- Good for development

**Cons:**
- Only works for localhost origins
- Not suitable for remote connections

### Option 3: Use Host Header Fallback (Already Enabled)

You have `dangerouslyAllowHostHeaderOriginFallback: true`, but this may not work as expected with WebSocket connections from Node.js.

**Pros:**
- Flexible for development
- No origin header needed

**Cons:**
- Security risk in production
- May not work with all connection types

## Recommended Solution: Fix the WebSocket Client

### Step 1: Update WebSocket Client to Send Origin Header

**File:** `lib/gateway/client.ts`

```typescript
constructor(url = 'ws://127.0.0.1:18789', opts?: { 
  authToken?: string; 
  deviceId?: string; 
  devicePublicKey?: string; 
  devicePrivateKey?: string;
  origin?: string;  // Add origin option
}) {
  this.url = url
  this.authToken = opts?.authToken
  this.origin = opts?.origin  // Store origin
  
  // ... rest of constructor
}

async connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Determine origin to send
      const origin = this.origin || this.determineOrigin()
      
      this.ws = new WebSocket(this.url, {
        maxPayload: 25 * 1024 * 1024,
        headers: {
          'Origin': origin  // ✅ Explicitly set Origin header
        }
      })
      
      // ... rest of connect logic
    } catch (error) {
      reject(error)
    }
  })
}

private determineOrigin(): string {
  // For server-side connections, use a configured origin
  // Priority: explicit option > environment variable > localhost fallback
  
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

### Step 2: Update Gateway Manager to Pass Origin

**File:** `lib/gateway/manager.ts`

```typescript
async connectGateway(gateway: Gateway): Promise<void> {
  console.log('[GatewayManager] Connecting to gateway', {
    gatewayId: gateway.id,
    url: gateway.url,
    hasAuthToken: !!gateway.auth_token,
    hasDeviceId: !!gateway.device_id
  })

  this.disconnectGateway(gateway.id)

  // Determine the origin to use
  const origin = this.determineOriginForGateway(gateway)

  const client = new GatewayClient(gateway.url, {
    authToken: gateway.auth_token ?? undefined,
    deviceId: gateway.device_id ?? undefined,
    devicePublicKey: gateway.device_public_key ?? undefined,
    devicePrivateKey: gateway.device_private_key ?? undefined,
    origin: origin  // ✅ Pass origin
  })
  
  // ... rest of method
}

private determineOriginForGateway(gateway: Gateway): string {
  // Use environment variable if set
  if (process.env.CLAWHUB_ORIGIN) {
    return process.env.CLAWHUB_ORIGIN
  }
  
  // Parse gateway URL
  const gatewayUrl = new URL(gateway.url)
  const protocol = gatewayUrl.protocol === 'wss:' ? 'https:' : 'http:'
  
  // For localhost gateways, use localhost origin
  if (gatewayUrl.hostname === 'localhost' || gatewayUrl.hostname === '127.0.0.1') {
    return `${protocol}//localhost:18789`
  }
  
  // For remote gateways, construct origin from gateway URL
  return `${protocol}//${gatewayUrl.host}`
}
```

### Step 3: Add Environment Variable Support

**File:** `.env.local` (create if doesn't exist)

```bash
# Origin to use for OpenClaw gateway connections
# This should match one of the origins in gateway.controlUi.allowedOrigins
CLAWHUB_PUBLIC_HOST=YOUR_SERVER_HOST
CLAWHUB_ORIGIN=http://YOUR_SERVER_HOST:7777
```

### Step 4: Update Gateway Configuration

Ensure your OpenClaw config has all necessary origins:

**File:** `~/.openclaw/openclaw.json`

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
        "http://YOUR_SERVER_HOST:7777",
        "http://localhost:7777",
        "http://127.0.0.1:7777",
        "http://YOUR_SERVER_HOST:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
      ],
      "allowInsecureAuth": true,
      "dangerouslyAllowHostHeaderOriginFallback": true
    },
    "auth": {
      "mode": "token",
      "token": "YOUR_GATEWAY_TOKEN"
    }
  }
}
```

### Step 5: Restart OpenClaw Gateway

After making config changes:

```bash
# Stop the gateway
openclaw gateway stop

# Start the gateway
openclaw gateway start

# Or restart
openclaw gateway restart

# Verify it's running
openclaw gateway status
```

## Alternative Quick Fix (For Testing)

If you want to test immediately without code changes:

### Option A: Disable Origin Check (Development Only)

**⚠️ WARNING: This is insecure and should only be used for local development**

Add to your OpenClaw config:

```json
{
  "gateway": {
    "controlUi": {
      "dangerouslyDisableOriginCheck": true
    }
  }
}
```

Then restart the gateway.

### Option B: Connect from Localhost

If your ClawAgentHub is running on the same machine as OpenClaw:

1. Access ClawAgentHub via `http://localhost:7777` instead of `http://YOUR_SERVER_HOST:7777`
2. The localhost origin should be automatically allowed

## Testing the Fix

### Test 1: Verify Origin Header is Sent

Add logging to your WebSocket client:

```typescript
console.log('[GatewayClient] Connecting with origin:', origin)
this.ws = new WebSocket(this.url, {
  maxPayload: 25 * 1024 * 1024,
  headers: {
    'Origin': origin
  }
})
```

### Test 2: Check Gateway Logs

Monitor OpenClaw gateway logs:

```bash
openclaw gateway logs --follow
```

Look for connection attempts and origin validation messages.

### Test 3: Test Connection Flow

1. Start ClawAgentHub: `npm run dev`
2. Navigate to gateway management page
3. Try to connect to a gateway
4. Check for successful connection or error messages

## Common Issues and Solutions

### Issue: "Origin still not allowed" after adding to config

**Solution:**
1. Verify the exact origin format (no trailing slash, correct protocol)
2. Restart the OpenClaw gateway
3. Clear any cached connections
4. Check gateway logs for the actual origin being received

### Issue: "Connection refused" or "ECONNREFUSED"

**Solution:**
1. Verify OpenClaw gateway is running: `openclaw gateway status`
2. Check the gateway URL is correct
3. Verify firewall allows connections on port 18789

### Issue: "Device identity mismatch"

**Solution:**
This is a separate issue. See [`OPENCLAW_GATEWAY_CONNECTION_ANALYSIS.md`](./OPENCLAW_GATEWAY_CONNECTION_ANALYSIS.md) for device identity fixes.

## Security Considerations

### Production Deployment

For production, you should:

1. **Use HTTPS/WSS** - Encrypt all connections
2. **Strict Origin Whitelist** - Only allow known origins
3. **Disable Insecure Auth** - Set `allowInsecureAuth: false`
4. **Disable Host Header Fallback** - Set `dangerouslyAllowHostHeaderOriginFallback: false`
5. **Use Strong Tokens** - Generate cryptographically secure gateway tokens

### Development vs Production Config

**Development:**
```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": ["http://localhost:7777"],
      "allowInsecureAuth": true,
      "dangerouslyAllowHostHeaderOriginFallback": true
    }
  }
}
```

**Production:**
```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": ["https://your-domain.com"],
      "allowInsecureAuth": false,
      "dangerouslyAllowHostHeaderOriginFallback": false
    },
    "auth": {
      "mode": "token",
      "token": "your-secure-token-here"
    }
  }
}
```

## Implementation Checklist

- [ ] Update `GatewayClient` constructor to accept `origin` parameter
- [ ] Add `determineOrigin()` method to `GatewayClient`
- [ ] Update `connect()` method to send Origin header
- [ ] Update `GatewayManager` to pass origin when creating clients
- [ ] Add `CLAWHUB_ORIGIN` environment variable support
- [ ] Verify all origins are in OpenClaw config
- [ ] Restart OpenClaw gateway
- [ ] Test connection from ClawAgentHub
- [ ] Add logging for debugging
- [ ] Document the configuration for team members

## References

- [OpenClaw Control UI Documentation](https://docs.openclaw.ai/web/control-ui)
- [OpenClaw Gateway Security](https://docs.openclaw.ai/gateway/security)
- [OpenClaw Troubleshooting](https://docs.openclaw.ai/gateway/troubleshooting)
- [GitHub Issue #36056](https://github.com/openclaw/openclaw/issues/36056) - Similar origin error
- [GitHub Issue #29809](https://github.com/openclaw/openclaw/issues/29809) - Origin not allowed fix

## Next Steps

1. **Implement the WebSocket client fix** (Option 1 - Recommended)
2. **Test the connection** from ClawAgentHub
3. **If still failing**, check gateway logs for actual origin received
4. **Consider adding** a configuration UI for managing allowed origins
5. **Document** the setup process for other developers

---

**Need Help?**
- Check OpenClaw gateway logs: `openclaw gateway logs`
- Run diagnostics: `openclaw doctor`
- Check gateway status: `openclaw gateway status`
