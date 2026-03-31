import { getDatabase } from '../lib/db/index.js'
import { readFileSync } from 'fs'
import { join } from 'path'

async function applyMigration() {
  try {
    const db = getDatabase()
    
    // Check if migration already applied
    const existing = db.prepare('SELECT * FROM migrations WHERE name = ?').get('005_add_device_identity')
    
    if (existing) {
      console.log('✓ Migration 005_add_device_identity already applied')
      return
    }
    
    // Read migration file
    const migrationPath = join(process.cwd(), 'lib/db/migrations/005_add_device_identity.sql')
    const sql = readFileSync(migrationPath, 'utf-8')
    
    // Apply migration
    const statements = sql.split(';').filter(s => s.trim())
    for (const statement of statements) {
      db.exec(statement)
    }
    
    // Record migration
    db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(
      '005_add_device_identity',
      new Date().toISOString()
    )
    
    console.log('✓ Migration 005_add_device_identity applied successfully')
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  }
}

applyMigration()
