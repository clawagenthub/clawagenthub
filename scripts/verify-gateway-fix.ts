import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '../data/clawhub.db')
const db = new Database(dbPath)

console.log('🔍 Verifying Gateway Fix...\n')

// Check migration status
console.log('📋 Migration Status:')
const migrations = db.prepare('SELECT * FROM migrations ORDER BY id').all()
migrations.forEach((m: any) => {
  console.log(`  ✓ Migration ${m.id}: ${m.name}`)
})

// Check gateway data
console.log('\n🔌 Gateway Data:')
const gateways = db.prepare(`
  SELECT 
    id, 
    name, 
    device_id,
    CASE 
      WHEN device_public_key IS NOT NULL THEN 'Present (' || LENGTH(device_public_key) || ' chars)'
      ELSE 'Missing'
    END as public_key_status,
    CASE 
      WHEN device_private_key IS NOT NULL THEN 'Present (' || LENGTH(device_private_key) || ' chars)'
      ELSE 'Missing'
    END as private_key_status,
    status
  FROM gateways
`).all()

if (gateways.length === 0) {
  console.log('  ℹ️  No gateways found')
} else {
  gateways.forEach((g: any) => {
    console.log(`\n  Gateway: ${g.name}`)
    console.log(`    ID: ${g.id}`)
    console.log(`    Device ID: ${g.device_id}`)
    console.log(`    Public Key: ${g.public_key_status}`)
    console.log(`    Private Key: ${g.private_key_status}`)
    console.log(`    Status: ${g.status}`)
  })
}

// Verify schema
console.log('\n📊 Schema Verification:')
const columns = db.prepare("PRAGMA table_info(gateways)").all()
const hasPublicKey = columns.some((c: any) => c.name === 'device_public_key')
const hasPrivateKey = columns.some((c: any) => c.name === 'device_private_key')

console.log(`  device_public_key column: ${hasPublicKey ? '✅ Present' : '❌ Missing'}`)
console.log(`  device_private_key column: ${hasPrivateKey ? '✅ Present' : '❌ Missing'}`)

// Summary
console.log('\n📝 Summary:')
const allGatewaysHaveKeys = gateways.every((g: any) => 
  g.public_key_status.includes('Present') && g.private_key_status.includes('Present')
)

if (gateways.length === 0) {
  console.log('  ℹ️  No gateways to verify')
} else if (allGatewaysHaveKeys) {
  console.log('  ✅ All gateways have Ed25519 keys')
  console.log('  ✅ Ready to connect with OpenClaw Gateway Protocol v3')
} else {
  console.log('  ⚠️  Some gateways are missing keys')
  console.log('  💡 Run migration 006 again or delete and re-add gateways')
}

db.close()
