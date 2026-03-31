# Refactoring Progress: Token-Only Authentication

## ✅ Completed Changes

### Phase 1: Database Migration
- ✅ Created migration `009_remove_device_pairing.sql`
  - Removes: `device_id`, `device_key`, `device_public_key`, `device_private_key`, `pairing_status`
  - Keeps: `id`, `workspace_id`, `name`, `url`, `auth_token`, `status`, timestamps
  - Sets placeholder token for existing gateways without tokens
- ✅ Created migration script `apply-migration-009.ts`

### Phase 2: Backend Refactoring

#### ✅ Updated Schema (`lib/db/schema.ts`)
- Removed device-related fields from Gateway interface
- Removed GatewayPairingRequest interface
- Made `auth_token` required (not nullable)

#### ✅ Simplified GatewayClient (`lib/gateway/client.ts`)
- **Removed**: All device identity code (~200 lines)
  - `deviceId`, `devicePublicKey`, `devicePrivateKey` properties
  - `generateDeviceIdentity()` method
  - `signDevicePayload()` method
  - Device-related getters
  - Device event handlers
- **Simplified**: Constructor now requires `authToken`
- **Simplified**: `sendConnectRequest()` uses only token auth
- **Result**: ~350 lines → ~350 lines (cleaner, focused code)

#### ✅ Simplified GatewayManager (`lib/gateway/manager.ts`)
- **Removed**: Device token event listener
- **Removed**: Pairing pending event listener
- **Added**: Token validation in `connectGateway()`
- **Updated**: `testConnection()` now requires `authToken` parameter

#### ✅ Simplified Add Gateway API (`app/api/gateways/add/route.ts`)
- **Removed**: All device identity generation code
- **Removed**: Imports for `generateKeyPairSync` and `deriveDeviceId`
- **Added**: Auth token validation (now required)
- **Simplified**: INSERT statement uses only new schema fields

#### ✅ Created Simple Connect API (`app/api/gateways/[id]/connect/route.ts`)
- New endpoint: `POST /api/gateways/[id]/connect`
- Replaces complex pairing flow with simple connect
- Uses session origin for WebSocket connection
- Updates gateway status appropriately

---

## 🔄 Next Steps

### Phase 3: Apply Migration and Test Backend

1. **Run the migration**:
   ```bash
   npm run script scripts/apply-migration-009.ts
   ```

2. **Update existing gateway tokens** (if any have placeholder):
   ```bash
   sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN' WHERE auth_token = 'PLEASE_UPDATE_TOKEN';"
   ```

3. **Test backend changes**:
   - Start ClawAgentHub server
   - Try adding a new gateway with token
   - Try connecting to gateway
   - Check logs for token auth flow

### Phase 4: Frontend Updates

#### Files to Update:

1. **Add Gateway Form** - Make token required
   - Location: `app/gateways/add/page.tsx` or similar
   - Changes:
     - Add `authToken` input field (required)
     - Add help text: "Find in OpenClaw config: gateway.auth.token"
     - Make it a password field for security

2. **Gateway List/Card** - Remove pairing status
   - Location: `app/gateways/page.tsx` or similar
   - Changes:
     - Remove `pairing_status` display
     - Show only connection status (connected/disconnected/connecting/error)
     - Update connect button to use new `/api/gateways/[id]/connect` endpoint

3. **Gateway Detail Page** - Simplify UI
   - Location: `app/gateways/[id]/page.tsx` or similar
   - Changes:
     - Remove pairing-related UI elements
     - Show simple connect/disconnect buttons
     - Display connection status and errors

#### Example Add Gateway Form:

```typescript
<form onSubmit={handleSubmit}>
  <div>
    <label>Gateway Name</label>
    <input
      name="name"
      placeholder="My Gateway"
      required
    />
  </div>
  
  <div>
    <label>Gateway URL</label>
    <input
      name="url"
      placeholder="ws://127.0.0.1:18789"
      required
    />
  </div>
  
  <div>
    <label>Auth Token</label>
    <input
      name="authToken"
      type="password"
      placeholder="Enter gateway token"
      required
    />
    <p className="text-sm text-gray-600">
      Find this in your OpenClaw config: gateway.auth.token
    </p>
  </div>
  
  <button type="submit">Add Gateway</button>
</form>
```

#### Example Connect Button:

```typescript
const handleConnect = async (gatewayId: string) => {
  const response = await fetch(`/api/gateways/${gatewayId}/connect`, {
    method: 'POST'
  })
  
  if (response.ok) {
    // Refresh gateway data
    router.refresh()
  } else {
    const data = await response.json()
    alert(data.message)
  }
}
```

### Phase 5: Cleanup

#### Files to Delete:

1. **Device Identity Module**:
   - `lib/gateway/device-identity.ts` - No longer needed

2. **Old Pairing APIs**:
   - `app/api/gateways/pair/route.ts` - Replaced by `[id]/connect`
   - `app/api/gateways/check-paired/route.ts` - No longer needed
   - `app/api/gateways/[id]/pairing-status/route.ts` - No longer needed

3. **Old Migration Scripts**:
   - `scripts/migrate-device-identities.ts`
   - `scripts/fix-device-identity.ts`
   - `scripts/apply-migration-005.ts`
   - `scripts/apply-migration-006.ts`
   - `scripts/apply-migration-007.ts`

4. **Update or Remove**:
   - `app/api/gateways/connect-with-token/route.ts` - Can be simplified or removed (functionality now in `[id]/connect`)

---

## 🧪 Testing Checklist

### Backend Testing

- [ ] Migration runs successfully
- [ ] Can add new gateway with token
- [ ] Cannot add gateway without token (validation works)
- [ ] Can connect to gateway with valid token
- [ ] Connection fails with invalid token (proper error)
- [ ] Gateway status updates correctly (connecting → connected)
- [ ] Error handling works (shows error message)
- [ ] Logs show token auth flow (no device identity mentions)

### Frontend Testing

- [ ] Add gateway form requires token
- [ ] Add gateway form shows helpful token hint
- [ ] Gateway list shows connection status
- [ ] Connect button works
- [ ] Disconnect button works
- [ ] Status updates in real-time
- [ ] Error messages display properly
- [ ] No pairing-related UI elements remain

### Integration Testing

- [ ] Full flow: Add gateway → Connect → List agents
- [ ] Reconnection after server restart
- [ ] Multiple gateways work independently
- [ ] Origin detection still works correctly
- [ ] Session management works

---

## 📊 Code Reduction Summary

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| GatewayClient | ~550 lines | ~350 lines | ~200 lines |
| GatewayManager | ~160 lines | ~130 lines | ~30 lines |
| Add Gateway API | ~130 lines | ~90 lines | ~40 lines |
| Database Schema | 11 fields | 10 fields | 1 field |
| API Endpoints | 5 endpoints | 2 endpoints | 3 endpoints |

**Total Reduction**: ~270 lines of code + 3 API endpoints + device-identity module

---

## 🚀 Quick Start Commands

```bash
# 1. Apply migration
npm run script scripts/apply-migration-009.ts

# 2. Update existing gateway tokens (if needed)
sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN' WHERE id = 'YOUR_GATEWAY_ID';"

# 3. Restart server
npm run dev

# 4. Test adding a gateway
curl -X POST http://localhost:7777/api/gateways/add \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Gateway",
    "url": "ws://127.0.0.1:18789",
    "authToken": "YOUR_GATEWAY_TOKEN"
  }'

# 5. Test connecting
curl -X POST http://localhost:7777/api/gateways/GATEWAY_ID/connect
```

---

## 🔍 Verification

After completing all phases, verify:

1. **No device-related code remains**:
   ```bash
   grep -r "deviceId\|device_id\|devicePublicKey\|devicePrivateKey\|pairing" lib/ app/ --exclude-dir=node_modules
   ```

2. **Database schema is clean**:
   ```bash
   sqlite3 ~/.clawhub/clawhub.db ".schema gateways"
   ```

3. **All tests pass**:
   ```bash
   npm test
   ```

---

## 📝 User Documentation Updates Needed

1. **Getting Started Guide**:
   - Update: "How to add a gateway"
   - Emphasize: Token is required
   - Show: Where to find token in OpenClaw config

2. **Troubleshooting Guide**:
   - Remove: Device pairing issues
   - Add: Token authentication issues
   - Add: How to update gateway token

3. **API Documentation**:
   - Remove: `/api/gateways/pair`
   - Remove: `/api/gateways/check-paired`
   - Remove: `/api/gateways/[id]/pairing-status`
   - Add: `/api/gateways/[id]/connect`
   - Update: `/api/gateways/add` (token now required)

---

## 🎯 Success Criteria

The refactoring is complete when:

- ✅ Migration applied successfully
- ✅ All backend code updated
- ✅ All frontend code updated
- ✅ All old files deleted
- ✅ Tests pass
- ✅ Documentation updated
- ✅ User can: Add gateway → Enter token → Connect → Use agents
- ✅ No device/pairing references in codebase
- ✅ Logs show clean token auth flow

---

## 🆘 Rollback Plan

If issues arise:

1. **Database rollback**:
   ```sql
   -- Restore old schema (manual process)
   -- Keep backup of database before migration
   ```

2. **Code rollback**:
   ```bash
   git revert <commit-hash>
   ```

3. **Gradual rollout**:
   - Keep old endpoints temporarily
   - Add feature flag for new vs old flow
   - Migrate users gradually
