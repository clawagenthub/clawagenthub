import { createHash, sign } from 'crypto'

/**
 * Ed25519 SPKI prefix for extracting raw public key
 * This is the standard ASN.1 DER encoding prefix for Ed25519 public keys
 */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/**
 * Base64URL encoding (RFC 4648 §5)
 * Used by OpenClaw for device signatures
 * - No padding (=)
 * - Uses - instead of +
 * - Uses _ instead of /
 */
export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Extract raw 32-byte Ed25519 public key from DER-encoded SPKI format
 * OpenClaw expects device ID to be derived from the raw key, not the full DER
 * 
 * @param publicKeyDer - DER-encoded public key buffer
 * @returns Raw 32-byte Ed25519 public key
 * @throws Error if the key format is invalid
 */
export function extractRawPublicKey(publicKeyDer: Buffer): Buffer {
  console.log('[DeviceIdentity] Extracting raw public key', {
    inputLength: publicKeyDer.length,
    expectedLength: ED25519_SPKI_PREFIX.length + 32
  })
  
  // Ed25519 public keys in SPKI format are exactly 44 bytes:
  // - 12 bytes: SPKI prefix (302a300506032b6570032100)
  // - 32 bytes: Raw Ed25519 public key
  if (
    publicKeyDer.length === ED25519_SPKI_PREFIX.length + 32 &&
    publicKeyDer.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    console.log('[DeviceIdentity] Raw public key extracted successfully')
    return publicKeyDer.subarray(ED25519_SPKI_PREFIX.length)
  }
  
  console.error('[DeviceIdentity] Invalid Ed25519 public key format', {
    expectedLength: ED25519_SPKI_PREFIX.length + 32,
    actualLength: publicKeyDer.length
  })
  
  throw new Error(
    `Invalid Ed25519 public key format. Expected ${ED25519_SPKI_PREFIX.length + 32} bytes with SPKI prefix, got ${publicKeyDer.length} bytes`
  )
}

/**
 * Generate device ID from public key (OpenClaw-compatible)
 * Device ID = SHA256(raw 32-byte Ed25519 public key)
 * 
 * This matches OpenClaw's device identity algorithm:
 * https://github.com/openclaw/openclaw/blob/main/src/infra/device-identity.ts
 * 
 * @param publicKeyDer - DER-encoded public key buffer
 * @returns 64-character hex string (SHA256 hash)
 */
export function deriveDeviceId(publicKeyDer: Buffer): string {
  const rawKey = extractRawPublicKey(publicKeyDer)
  const deviceId = createHash('sha256').update(rawKey).digest('hex')
  
  console.log('[DeviceIdentity] Derived device ID', {
    deviceId: deviceId.substring(0, 16) + '...'
  })
  
  return deviceId
}

/**
 * Sign device authentication payload (OpenClaw-compatible)
 * Returns base64url-encoded signature
 *
 * The payload must be JSON-stringified in the exact format:
 * {"deviceId":"...","nonce":"...","signedAt":1234567890}
 *
 * @param privateKeyDer - DER-encoded private key buffer
 * @param payload - Device authentication payload (object or pre-stringified string)
 * @returns Base64URL-encoded signature
 */
export function signDevicePayload(
  privateKeyDer: Buffer,
  payload: { deviceId: string; nonce: string; signedAt: number } | string
): string {
  console.log('[DeviceIdentity] Signing payload', {
    payloadLength: typeof payload === 'string' ? payload.length : JSON.stringify(payload).length,
    isPreStringified: typeof payload === 'string'
  })
  
  // JSON.stringify with no spaces (compact format)
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
  
  // Sign using Ed25519
  const signature = sign(null, Buffer.from(payloadString, 'utf8'), {
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8'
  })
  
  // Return base64url-encoded signature (OpenClaw format)
  const encodedSignature = base64UrlEncode(signature)
  
  console.log('[DeviceIdentity] Payload signed successfully', {
    signatureLength: encodedSignature.length
  })
  
  return encodedSignature
}
