#!/usr/bin/env tsx
/**
 * Migration script to regenerate device identities for existing gateways
 * 
 * This script fixes the device ID format issue where device IDs were generated
 * with the 'clawhub-' prefix and truncated to 16 characters instead of
 * the full 64-character SHA256 hash required by OpenClaw.
 */

import { generateKeyPairSync, createHash } from 'crypto'
import Database from 'better-sqlite3'
import { resolve, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'

const DB_PATH = process.env.DATABASE_PATH || resolve(process.cwd(), 'data', 'clawhub.db')

interface Gateway {
  id: string
  name: string
  device_id: string | null
  device_public_key: string | null
  device_private_key: string | null
}

function generateDeviceIdentity(): { 
  deviceId: string
  publicKey: string
  privateKey: string
} {
  // Generate Ed25519 key pair
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  })
  
  // Generate device ID from public key (OpenClaw-compatible)
  // Device ID = SHA256(raw 32-byte Ed25519 public key)
  const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
  let rawPublicKey: Buffer
  if (publicKey.length === ED25519_SPKI_PREFIX.length + 32 &&
      publicKey.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    rawPublicKey = publicKey.subarray(ED25519_SPKI_PREFIX.length)
  } else {
    rawPublicKey = publicKey
  }
  
  const deviceId = createHash('sha256').update(rawPublicKey).digest('hex')
  
  return {
    deviceId,
    publicKey: publicKey.toString('base64'),
    privateKey: privateKey.toString('base64')
  }
}

function isOldDeviceIdFormat(deviceId: string | null): boolean {
  if (!deviceId) return true
  // Old format: 'clawhub-' prefix + 16 hex chars = 24 chars total
  // New format: 64 hex chars
  return deviceId.startsWith('clawhub-') || deviceId.length !== 64
}

async function migrateDeviceIdentities() {
  console.log('🔧 Starting device identity migration...')
  console.log(`📁 Database path: ${DB_PATH}`)
  
  // Ensure data directory exists
  const dbDir = dirname(DB_PATH)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  
  try {
    // Get all gateways
    const stmt = db.prepare('SELECT id, name, device_id, device_public_key, device_private_key FROM gateways')
    const gateways = stmt.all() as Gateway[]
    
    console.log(`\n📊 Found ${gateways.length} gateway(s)`)
    
    let migrated = 0
    let skipped = 0
    let errors = 0
    
    const updateStmt = db.prepare(`
      UPDATE gateways 
      SET device_id = ?, 
          device_public_key = ?, 
          device_private_key = ?,
          pairing_status = 'not_started',
          status = 'disconnected',
          auth_token = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `)
    
    for (const gateway of gateways) {
      try {
        console.log(`\n🔍 Checking gateway: ${gateway.name} (${gateway.id})`)
        
        // Check if device ID needs migration
        if (!isOldDeviceIdFormat(gateway.device_id)) {
          console.log(`  ✅ Device ID format is correct, skipping`)
          skipped++
          continue
        }
        
        console.log(`  ⚠️  Old device ID format detected: ${gateway.device_id}`)
        
        // Generate new device identity
        const identity = generateDeviceIdentity()
        
        // Update gateway in database
        updateStmt.run(
          identity.deviceId,
          identity.publicKey,
          identity.privateKey,
          gateway.id
        )
        
        console.log(`  ✅ Migrated to new device ID: ${identity.deviceId}`)
        migrated++
        
      } catch (error) {
        console.error(`  ❌ Error migrating gateway ${gateway.id}:`, error)
        errors++
      }
    }
    
    console.log(`\n📈 Migration Summary:`)
    console.log(`  ✅ Migrated: ${migrated}`)
    console.log(`  ⏭️  Skipped: ${skipped}`)
    console.log(`  ❌ Errors: ${errors}`)
    console.log(`  📊 Total: ${gateways.length}`)
    
    if (migrated > 0) {
      console.log(`\n⚠️  IMPORTANT: You will need to re-pair these gateways with your OpenClaw instance.`)
      console.log(`   The device identities have been regenerated and the old pairings are no longer valid.`)
    }
    
  } finally {
    db.close()
  }
  
  console.log('\n✨ Migration complete!')
}

// Run migration
migrateDeviceIdentities().catch(error => {
  console.error('❌ Migration failed:', error)
  process.exit(1)
})
