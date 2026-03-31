# Device Identity Fix - Testing Guide

## What Was Fixed

The "device identity mismatch" error was caused by three issues:

1. **Incorrect Device ID Generation**: Used full DER-encoded key instead of raw 32-byte Ed25519 key
2. **Wrong Device ID Format**: Used `clawhub-` prefix + 16 chars instead of full 64-char hex
3. **Wrong Signature Encoding**: Used standard base64 instead of base64url

## Files Changed

- ✅ [`lib/gateway/device-identity.ts`](../lib/gateway/device-identity.ts) - New utility functions
- ✅ [`app/api/gateways/add/route.ts`](../app/api/gateways/add/route.ts) - Fixed device ID generation
- ✅ [`lib/gateway/client.ts`](../lib/gateway/client.ts) - Fixed signature encoding
- ✅ [`scripts/fix-device-identity.ts`](../scripts/fix-device-identity.ts) - Migration script
- ✅ [`docs/DEVICE_IDENTITY.md`](../docs/DEVICE_IDENTITY.md) - Protocol documentation

## Testing Steps

### Step 1: Fix Existing Gateways (If Any)

If you have existing gateways with incorrect device IDs, run the migration:

```bash
cd githubprojects/clawhub
npx tsx scripts/fix-device-identity.ts
```

Expected output:
```
🔧 Starting device identity migration...

Found 1 gateway(s)

✅ Fixed local (abc123)
   Old: clawhub-a1b2c3d4e5f6
   New: a1b2c3d4e5f6789012345678901234567890123456789012345678901234

============================================================
Migration Summary:
============================================================
✅ Fixed:   1 gateway(s)
⏭️  Skipped: 0 gateway(s)
❌ Errors:  0 gateway(s)
============================================================

⚠️  Important: You need to re-pair these gateways in OpenClaw Control UI
   The device ID has changed, so the gateway will need approval again.

✅ Migration completed successfully
```

### Step 2: Delete Old Gateway (Recommended)

For a clean test, delete the existing gateway:

1. Go to ClawAgentHub Gateways page
2. Click "Delete" on the gateway with the old device ID
3. Confirm deletion

### Step 3: Add New Gateway

1. Click "Add Gateway" button
2. Enter gateway details:
   - **Name**: `local` (or any name)
   - **Connection Type**: `localhost` or `remote`
   - **URL**: `ws://127.0.0.1:18789` (or your gateway URL)
3. Click "Add Gateway"

### Step 4: Verify Device ID Format

Check the database to verify the device ID is correct:

```bash
sqlite3 githubprojects/clawhub/data/clawhub.db "SELECT name, device_id FROM gateways;"
```

Expected output:
```
local|a1b2c3d4e5f6789012345678901234567890123456789012345678901234
```

✅ **Correct**: 64-character hex string (no prefix)
❌ **Wrong**: `clawhub-a1b2c3d4e5f6` (old format)

### Step 5: Initiate Pairing

1. Click "Connect" button on the gateway
2. The pairing modal should open
3. Click "I Paired" button
4. Check the status - should show "Pairing Request Pending Approval"

### Step 6: Check OpenClaw Logs

On your OpenClaw gateway, check the logs:

```bash
openclaw logs --follow
```

Look for:
- ✅ **Good**: `pairing request` or `device pending approval`
- ❌ **Bad**: `device identity mismatch` or `device signature invalid`

### Step 7: Approve Device in OpenClaw

**Option A: Using Control UI**
1. Open OpenClaw Control UI: `http://localhost:18789`
2. Go to Devices/Nodes section
3. Find the pending device (should show ClawAgentHub)
4. Click "Approve"

**Option B: Using CLI**
```bash
openclaw devices list
openclaw devices approve --latest
```

### Step 8: Verify Connection

Back in ClawAgentHub:
1. The pairing modal should automatically update to "Gateway connected successfully!"
2. The gateway status should change to "Connected"
3. The error message should be gone

## Troubleshooting

### Still Getting "device identity mismatch"

1. **Check device ID format**:
   ```bash
   sqlite3 githubprojects/clawhub/data/clawhub.db "SELECT device_id FROM gateways;"
   ```
   Should be 64 characters, no prefix

2. **Check OpenClaw logs** for specific error:
   ```bash
   openclaw logs --follow | grep -i "device\|identity\|signature"
   ```

3. **Verify the fix was applied**:
   ```bash
   grep -n "deriveDeviceId" githubprojects/clawhub/app/api/gateways/add/route.ts
   grep -n "signDevicePayload" githubprojects/clawhub/lib/gateway/client.ts
   ```

### "device signature invalid"

This means the signature format is still wrong. Check:
1. Is `signDevicePayload` imported in [`client.ts`](../lib/gateway/client.ts)?
2. Is the signature using base64url encoding?

### "device nonce mismatch"

The nonce from `connect.challenge` doesn't match. This shouldn't happen with the current code, but if it does:
1. Check that the nonce is being passed correctly to `signDevicePayload`
2. Verify the payload structure matches exactly

## Success Criteria

✅ Device ID is 64-character hex (no prefix)
✅ No "device identity mismatch" error
✅ Pairing request appears in OpenClaw
✅ After approval, connection succeeds
✅ Gateway status shows "Connected"

## Rollback (If Needed)

If something goes wrong, you can rollback:

```bash
cd githubprojects/clawhub
git checkout HEAD -- lib/gateway/device-identity.ts
git checkout HEAD -- app/api/gateways/add/route.ts
git checkout HEAD -- lib/gateway/client.ts
```

Then delete and re-add the gateway.

## Need Help?

- Check [`docs/DEVICE_IDENTITY.md`](../docs/DEVICE_IDENTITY.md) for protocol details
- Review OpenClaw troubleshooting: https://github.com/openclaw/openclaw/blob/main/docs/gateway/troubleshooting.md
- Check OpenClaw device identity source: https://github.com/openclaw/openclaw/blob/main/src/infra/device-identity.ts
