# OpenClaw Device Identity Protocol

This document explains how ClawAgentHub implements OpenClaw's device identity protocol for gateway authentication.

## Overview

OpenClaw uses Ed25519 cryptographic signatures for device authentication. Each device (like ClawAgentHub) generates a unique identity that the gateway can verify and approve.

## Device Identity Components

### 1. Ed25519 Key Pair
- **Public Key**: 32-byte Ed25519 public key (stored as DER-encoded SPKI format)
- **Private Key**: Ed25519 private key (stored as DER-encoded PKCS#8 format)

### 2. Device ID
The device ID is derived from the public key:

```typescript
Device ID = SHA256(raw 32-byte Ed25519 public key)
```

**Important**: The device ID is computed from the **raw 32-byte key**, not the full DER-encoded SPKI structure.

#### SPKI Structure
Ed25519 public keys in SPKI format are 44 bytes:
- Bytes 0-11: SPKI prefix (`302a300506032b6570032100` in hex)
- Bytes 12-43: Raw 32-byte Ed25519 public key

The device ID is the SHA256 hash of bytes 12-43 only.

### 3. Device Signature
During authentication, the device signs a payload containing:
```json
{
  "deviceId": "64-character-hex-device-id",
  "nonce": "challenge-nonce-from-gateway",
  "signedAt": 1234567890
}
```

The signature is encoded using **Base64URL** (RFC 4648 §5):
- No padding (`=` characters removed)
- Uses `-` instead of `+`
- Uses `_` instead of `/`

## Authentication Flow

```
1. Client connects to gateway WebSocket
   ↓
2. Gateway sends connect.challenge event with nonce
   ↓
3. Client signs payload with device private key
   ↓
4. Client sends connect request with:
   - device.id (device ID)
   - device.publicKey (base64-encoded)
   - device.nonce (same nonce from challenge)
   - device.signedAt (current timestamp)
   - device.signature (base64url-encoded)
   ↓
5. Gateway verifies signature
   ↓
6. If device is approved: connection succeeds
   If device is pending: pairing approval required
   If signature invalid: "device identity mismatch" error
```

## Common Errors

### "device identity mismatch"
**Cause**: The device ID in the signature payload doesn't match the device ID derived from the public key.

**Fix**: Ensure device ID is computed correctly:
1. Extract raw 32-byte key from SPKI structure
2. Hash with SHA256
3. Use full 64-character hex (no prefix, no truncation)

### "device signature invalid"
**Cause**: Signature verification failed.

**Possible reasons**:
- Wrong signature encoding (must be base64url, not standard base64)
- Payload format mismatch
- Wrong private key used
- Timestamp too old (replay protection)

### "device nonce mismatch"
**Cause**: The nonce in the signature payload doesn't match the challenge nonce.

**Fix**: Use the exact nonce from the `connect.challenge` event.

## Implementation Files

- [`lib/gateway/device-identity.ts`](../lib/gateway/device-identity.ts) - Device identity utilities
- [`lib/gateway/client.ts`](../lib/gateway/client.ts) - Gateway client with device auth
- [`app/api/gateways/add/route.ts`](../app/api/gateways/add/route.ts) - Gateway creation endpoint
- [`scripts/fix-device-identity.ts`](../scripts/fix-device-identity.ts) - Migration script

## References

- [OpenClaw Device Identity Source](https://github.com/openclaw/openclaw/blob/main/src/infra/device-identity.ts)
- [OpenClaw Gateway Troubleshooting](https://github.com/openclaw/openclaw/blob/main/docs/gateway/troubleshooting.md)
- [RFC 4648 - Base64URL Encoding](https://datatracker.ietf.org/doc/html/rfc4648#section-5)

## Migration Guide

If you have existing gateways with incorrect device IDs, run the migration script:

```bash
npx tsx scripts/fix-device-identity.ts
```

After migration:
1. The device IDs will be regenerated correctly
2. You'll need to re-pair the gateways in OpenClaw Control UI
3. The gateway will show as a new device requiring approval

## Testing

To verify correct implementation:

1. **Check Device ID Format**
   - Should be 64 characters (hex)
   - No prefix like `clawhub-`
   - Example: `a1b2c3d4e5f6...` (64 chars)

2. **Check Signature Encoding**
   - Should use base64url (no `+`, `/`, or `=`)
   - Example: `abc123-_xyz` (note `-` and `_`)

3. **Test Connection**
   - Add gateway in ClawAgentHub
   - Initiate pairing
   - Check OpenClaw logs for errors
   - Approve device in Control UI
   - Verify connection succeeds
