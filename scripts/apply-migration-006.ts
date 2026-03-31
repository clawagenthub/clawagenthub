import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '../data/clawhub.db')
const db = new Database(dbPath)

console.log('📦 Applying migration 006: Update device keys...')

try {
  // Read and execute migration
  const migrationSQL = readFileSync(
    join(__dirname, '../lib/db/migrations/006_update_device_keys.sql'),
    'utf-8'
  )

  db.exec(migrationSQL)

  // Record migration
  db.prepare(
    'INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)'
  ).run(6, '006_update_device_keys', new Date().toISOString())

  console.log('✅ Migration 006 applied successfully')
  
  // Regenerate keys for existing gateways
  console.log('🔄 Regenerating keys for existing gateways...')
  
  const { generateKeyPairSync } = await import('crypto')
  const { createHash } = await import('crypto')
  
  const gateways = db.prepare('SELECT id FROM gateways WHERE device_public_key IS NULL').all() as Array<{ id: string }>
  
  for (const gateway of gateways) {
    // Generate Ed25519 key pair
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    })
    
    // Generate device ID from public key
    const hash = createHash('sha256')
    hash.update(publicKey)
    const deviceId = 'clawhub-' + hash.digest('hex').substring(0, 16)
    
    const devicePublicKey = publicKey.toString('base64')
    const devicePrivateKey = privateKey.toString('base64')
    
    // Update gateway
    db.prepare(`
      UPDATE gateways 
      SET device_id = ?, device_public_key = ?, device_private_key = ?
      WHERE id = ?
    `).run(deviceId, devicePublicKey, devicePrivateKey, gateway.id)
    
    console.log(`  ✓ Updated gateway ${gateway.id}`)
  }
  
  console.log(`✅ Regenerated keys for ${gateways.length} gateway(s)`)
} catch (error) {
  console.error('❌ Migration failed:', error)
  process.exit(1)
}

db.close()
