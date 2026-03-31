import { getDatabase } from '../lib/db/index.js'
import { deriveDeviceId } from '../lib/gateway/device-identity.js'

/**
 * Migration script to regenerate device IDs for existing gateways
 * 
 * This fixes gateways created with the incorrect device ID generation algorithm.
 * The old algorithm used:
 *   - Full DER-encoded public key (instead of raw 32-byte key)
 *   - 'clawhub-' prefix + 16 characters (instead of full 64-char hex)
 * 
 * The correct OpenClaw-compatible algorithm:
 *   - Extract raw 32-byte Ed25519 public key from SPKI structure
 *   - SHA256 hash of the raw key
 *   - Full 64-character hex string (no prefix)
 * 
 * Run this script once after deploying the fix:
 *   npx tsx scripts/fix-device-identity.ts
 */

interface Gateway {
  id: string
  name: string
  device_id: string | null
  device_public_key: string | null
}

async function fixDeviceIdentities() {
  console.log('🔧 Starting device identity migration...\n')
  
  const db = getDatabase()
  
  // Fetch all gateways with device public keys
  const gateways = db
    .prepare('SELECT id, name, device_id, device_public_key FROM gateways')
    .all() as Gateway[]
  
  if (gateways.length === 0) {
    console.log('ℹ️  No gateways found in database')
    return
  }
  
  console.log(`Found ${gateways.length} gateway(s)\n`)
  
  let fixed = 0
  let skipped = 0
  let errors = 0
  
  for (const gateway of gateways) {
    if (!gateway.device_public_key) {
      console.log(`⏭️  Skipping ${gateway.name} (${gateway.id}): No device public key`)
      skipped++
      continue
    }
    
    try {
      // Convert base64 public key to buffer
      const publicKeyBuffer = Buffer.from(gateway.device_public_key, 'base64')
      
      // Generate correct device ID using OpenClaw algorithm
      const correctDeviceId = deriveDeviceId(publicKeyBuffer)
      
      // Check if device ID needs updating
      if (gateway.device_id === correctDeviceId) {
        console.log(`✓ ${gateway.name} (${gateway.id}): Device ID already correct`)
        skipped++
        continue
      }
      
      // Update the device ID
      db.prepare('UPDATE gateways SET device_id = ?, updated_at = ? WHERE id = ?').run(
        correctDeviceId,
        new Date().toISOString(),
        gateway.id
      )
      
      console.log(`✅ Fixed ${gateway.name} (${gateway.id})`)
      console.log(`   Old: ${gateway.device_id}`)
      console.log(`   New: ${correctDeviceId}\n`)
      fixed++
    } catch (error) {
      console.error(`❌ Failed to fix ${gateway.name} (${gateway.id}):`, error)
      errors++
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Migration Summary:')
  console.log('='.repeat(60))
  console.log(`✅ Fixed:   ${fixed} gateway(s)`)
  console.log(`⏭️  Skipped: ${skipped} gateway(s)`)
  console.log(`❌ Errors:  ${errors} gateway(s)`)
  console.log('='.repeat(60))
  
  if (fixed > 0) {
    console.log('\n⚠️  Important: You need to re-pair these gateways in OpenClaw Control UI')
    console.log('   The device ID has changed, so the gateway will need approval again.')
  }
}

// Run migration if executed directly
if (require.main === module) {
  fixDeviceIdentities()
    .then(() => {
      console.log('\n✅ Migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error)
      process.exit(1)
    })
}

export { fixDeviceIdentities }
