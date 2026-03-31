# Quick Start: Apply Token-Only Authentication

## 🚀 Step-by-Step Implementation

### Step 1: Apply Database Migration (5 minutes)

```bash
# Navigate to your ClawAgentHub directory
cd githubprojects/clawhub

# Run the migration
npm run script scripts/apply-migration-009.ts

# Verify migration
sqlite3 ~/.clawhub/clawhub.db ".schema gateways"
```

**Expected output**: Gateway table should only have these fields:
- id, workspace_id, name, url, auth_token, status, last_connected_at, last_error, created_at, updated_at

### Step 2: Update Existing Gateway Tokens (2 minutes)

```bash
# Check which gateways need tokens
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, auth_token FROM gateways;"

# Update with your OpenClaw token (replace YOUR_GATEWAY_ID and YOUR_TOKEN)
sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN' WHERE id = 'YOUR_GATEWAY_ID';"

# Verify
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, auth_token FROM gateways;"
```

### Step 3: Restart ClawAgentHub Server

```bash
# Stop current server (Ctrl+C)

# Start server
npm run dev
```

### Step 4: Test Backend (5 minutes)

**Test 1: Add a new gateway**

```bash
curl -X POST http://localhost:7777/api/gateways/add \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Test Gateway",
    "url": "ws://127.0.0.1:18789",
    "authToken": "YOUR_GATEWAY_TOKEN"
  }'
```

**Test 2: Connect to gateway**

```bash
curl -X POST http://localhost:7777/api/gateways/GATEWAY_ID/connect \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN"
```

**Test 3: Check logs**

Look for these log messages:
```
[GatewayClient] Initializing with token auth { url: 'ws://127.0.0.1:18789', hasAuthToken: true }
[GatewayClient] Connecting with origin: http://localhost:7777
[GatewayClient] Sending connect request with token auth
[GatewayClient] Successfully authenticated
[GatewayManager] Gateway connected successfully
```

### Step 5: Frontend Updates (Optional - if you have UI)

If you have a frontend, update these components:

**1. Add Gateway Form** - Add token input:
```typescript
<input
  name="authToken"
  type="password"
  placeholder="Gateway Token"
  required
/>
<p>Find in OpenClaw config: gateway.auth.token</p>
```

**2. Gateway List** - Update connect button:
```typescript
const handleConnect = async (gatewayId: string) => {
  await fetch(`/api/gateways/${gatewayId}/connect`, { method: 'POST' })
  router.refresh()
}
```

### Step 6: Cleanup (Optional)

Delete old files that are no longer needed:

```bash
# Delete device identity module
rm lib/gateway/device-identity.ts

# Delete old pairing APIs
rm app/api/gateways/pair/route.ts
rm app/api/gateways/check-paired/route.ts
rm app/api/gateways/[id]/pairing-status/route.ts

# Delete old migration scripts
rm scripts/migrate-device-identities.ts
rm scripts/fix-device-identity.ts
rm scripts/apply-migration-005.ts
rm scripts/apply-migration-006.ts
rm scripts/apply-migration-007.ts
```

---

## ✅ Verification Checklist

After completing the steps above:

- [ ] Migration applied successfully
- [ ] Existing gateways have valid tokens
- [ ] Server starts without errors
- [ ] Can add new gateway with token
- [ ] Can connect to gateway
- [ ] Logs show token auth (not device identity)
- [ ] Gateway status updates correctly
- [ ] No TypeScript errors in modified files

---

## 🐛 Troubleshooting

### Issue: "Gateway auth token is required"

**Solution**: Make sure you're providing `authToken` when adding a gateway:
```json
{
  "name": "My Gateway",
  "url": "ws://127.0.0.1:18789",
  "authToken": "YOUR_GATEWAY_TOKEN"  // ← Required!
}
```

### Issue: "Connection failed" or "UNAUTHORIZED"

**Solution**: Token mismatch. Check both configs match:

**ClawAgentHub database**:
```bash
sqlite3 ~/.clawhub/clawhub.db "SELECT auth_token FROM gateways;"
```

**OpenClaw config** (`.openclaw/openclaw.json`):
```json
{
  "gateway": {
    "auth": {
      "token": "YOUR_GATEWAY_TOKEN"  // ← Must match database
    }
  }
}
```

### Issue: "ORIGIN_NOT_ALLOWED"

**Solution**: This is a separate issue. Make sure your origin is in OpenClaw's allowed list:
```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:7777"
      ]
    }
  }
}
```

### Issue: Migration fails

**Solution**: Check if migration already applied:
```bash
sqlite3 ~/.clawhub/clawhub.db "SELECT * FROM migrations WHERE name = '009_remove_device_pairing';"
```

If it exists, migration is already applied. If you need to re-run:
```bash
sqlite3 ~/.clawhub/clawhub.db "DELETE FROM migrations WHERE name = '009_remove_device_pairing';"
npm run script scripts/apply-migration-009.ts
```

---

## 📊 Before vs After

### Before (Complex)
```
User adds gateway
  ↓
System generates Ed25519 keys
  ↓
System derives device ID
  ↓
User clicks "Pair"
  ↓
System sends device signature
  ↓
User approves in OpenClaw UI
  ↓
Connected ✅
```

### After (Simple)
```
User adds gateway + token
  ↓
User clicks "Connect"
  ↓
Connected ✅
```

---

## 🎯 Success!

If you can:
1. ✅ Add a gateway with token
2. ✅ Connect to the gateway
3. ✅ See "Successfully authenticated" in logs
4. ✅ Gateway status shows "connected"

**You're done!** The refactoring is complete and working.

---

## 📞 Need Help?

Check these documents:
- [`REFACTORING_PROGRESS.md`](./REFACTORING_PROGRESS.md) - Detailed progress and next steps
- [`REMOVE_DEVICE_PAIRING_REFACTOR_PLAN.md`](./REMOVE_DEVICE_PAIRING_REFACTOR_PLAN.md) - Complete refactoring plan
- [`TOKEN_AUTH_IMPLEMENTATION_GUIDE.md`](./TOKEN_AUTH_IMPLEMENTATION_GUIDE.md) - Implementation details

Or review the logs for specific error messages.
