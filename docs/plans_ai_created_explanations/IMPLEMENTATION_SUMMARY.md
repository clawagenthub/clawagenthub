# OpenClaw Gateway Connection Fix - Implementation Summary

## ✅ Changes Implemented

### 1. Fixed Device Identity Generation (`lib/gateway/client.ts`)

**Problem:** Device IDs were generated with `'clawhub-'` prefix and truncated to 16 characters instead of the full 64-character SHA256 hash.

**Solution:** 
- Updated `generateDeviceIdentity()` to extract the raw 32-byte Ed25519 public key from SPKI format
- Generate device ID as full 64-character SHA256 hash (OpenClaw-compatible)

```typescript
// Now generates proper device ID:
// Before: "clawhub-a1b2c3d4e5f6g7h8" (wrong)
// After:  "a1b2c3d4e5f6..." (64 chars, correct)
```

### 2. Fixed Signature Payload Format (`lib/gateway/client.ts`)

**Problem:** The signature payload only included `deviceId`, `nonce`, and `signedAt`, but OpenClaw expects a V3 format with additional fields.

**Solution:**
- Updated `signDevicePayload()` to use OpenClaw's V3 payload format:
  - `deviceId`, `clientId`, `clientMode`, `role`, `scopes`
  - `signedAtMs`, `token`, `nonce`, `platform`, `deviceFamily`

### 3. Updated Device Identity Module (`lib/gateway/device-identity.ts`)

**Problem:** The `signDevicePayload()` function only accepted object payloads.

**Solution:**
- Modified to accept both object and pre-stringified string payloads
- Ensures proper JSON formatting for signature verification

### 4. Created Migration Script (`scripts/migrate-device-identities.ts`)

**Purpose:** Regenerate device identities for existing gateways with incorrect format.

**Usage:**
```bash
cd /root/githubprojects/clawhub
npx tsx scripts/migrate-device-identities.ts
```

This will:
- Scan all gateways in the database
- Detect gateways with old device ID format
- Generate new Ed25519 key pairs
- Update database with correct device identities
- Reset pairing status to 'not_started'

### 5. Created Token-Based Connection API (`app/api/gateways/connect-with-token/route.ts`)

**New Endpoint:** `POST /api/gateways/connect-with-token`

**Request Body:**
```json
{
  "gatewayId": "gateway-id",
  "gatewayToken": "your-gateway-auth-token"
}
```

**Features:**
- Connect using gateway auth token (from `gateway.auth.token`)
- Bypasses device pairing flow
- Stores token in database for future connections

### 6. Updated Pairing Modal UI (`components/gateway/pairing-modal.tsx`)

**New Features:**
- **Two connection methods:**
  1. **Device Pairing** (traditional) - Requires approving device in OpenClaw
  2. **Connect with Token** (new) - Uses gateway auth token directly

- **Token Connection Tab:**
  - Input field for gateway token
  - Instructions on how to find token
  - Direct connection without pairing approval

## 🚀 How to Use

### For New Gateways

1. **Add Gateway:**
   ```bash
   # Use the existing add gateway flow
   # Device identity will be generated correctly
   ```

2. **Connect via Pairing:**
   - Click "Pair" on the gateway
   - Approve device in OpenClaw Control UI
   - Click "I Paired" to complete

3. **Connect via Token:**
   - Click "Pair" on the gateway
   - Select "Connect with Token" tab
   - Enter your gateway token (from `openclaw.json`)
   - Click "Connect"

### For Existing Gateways (Migration Required)

1. **Run Migration:**
   ```bash
   cd /root/githubprojects/clawhub
   npx tsx scripts/migrate-device-identities.ts
   ```

2. **Re-pair Gateways:**
   - All gateways will need to be re-paired
   - Use either pairing method or token method

## 📋 OpenClaw Gateway Token Location

Your OpenClaw gateway token can be found in:

1. **Config file:**
   ```bash
   cat ~/.openclaw/config.json | grep token
   ```

2. **CLI command:**
   ```bash
   openclaw config get gateway.auth.token
   ```

3. **Environment variable:**
   ```bash
   echo $OPENCLAW_GATEWAY_TOKEN
   ```

## 🔧 Technical Details

### Device Identity Format

OpenClaw expects:
- **Device ID:** SHA256(raw 32-byte Ed25519 public key) = 64 hex characters
- **Public Key:** DER-encoded SPKI format (base64)
- **Private Key:** DER-encoded PKCS8 format (base64)

### Authentication Flow

1. **WebSocket Connect** → Gateway sends `connect.challenge` with nonce
2. **Sign Payload** → Client signs V3 payload with Ed25519 private key
3. **Send Connect Request** → Includes device identity + signature + optional token
4. **Gateway Verification** → Validates device ID, signature, and optional token
5. **Pairing Check** → If not paired, requires approval (unless using token + allowInsecureAuth)

### Signature Payload V3 Format

```json
{
  "deviceId": "64-char-hex",
  "clientId": "cli",
  "clientMode": "cli",
  "role": "operator",
  "scopes": ["operator.admin"],
  "signedAtMs": 1234567890,
  "token": "gateway-token-or-null",
  "nonce": "challenge-nonce",
  "platform": "node",
  "deviceFamily": null
}
```

**Important:** The JSON must be stringified without spaces for the signature to verify correctly.

## ⚠️ Important Notes

1. **Migration Required:** Existing gateways with old device IDs will not work until migrated
2. **Re-pairing:** After migration, all gateways need to be re-paired
3. **Token Security:** Store gateway tokens securely - they provide full access to the gateway
4. **Device Identity:** Each workspace/gateway should have its own unique device identity

## 🐛 Troubleshooting

### "device-id-mismatch" Error Still Occurs

1. Run the migration script
2. Verify the device ID in database is 64 characters
3. Check that the public key is in correct SPKI format

### Token Connection Fails

1. Verify token is correct: `openclaw config get gateway.auth.token`
2. Check gateway is running: `openclaw gateway status`
3. Verify network connectivity to gateway
4. Check gateway logs: `journalctl --user -u openclaw -f`

### Signature Verification Fails

1. Ensure payload is JSON-stringified without spaces
2. Verify Ed25519 key pair is valid
3. Check that signedAtMs is within 2 minutes (gateway checks for timestamp skew)

## 📚 References

- OpenClaw Device Identity: https://github.com/openclaw/openclaw/blob/main/src/infra/device-identity.ts
- OpenClaw Protocol: https://docs.openclaw.ai/gateway/protocol
- OpenClaw Troubleshooting: https://docs.openclaw.ai/gateway/troubleshooting
