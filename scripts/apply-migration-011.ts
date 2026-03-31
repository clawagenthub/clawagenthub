import { getDatabase } from '../lib/db'
import fs from 'fs'
import path from 'path'

async function applyMigration() {
  const db = getDatabase()
  
  try {
    console.log('Applying migration 011: Add session status tracking...')
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../lib/db/migrations/011_add_session_status.sql')
    const migration = fs.readFileSync(migrationPath, 'utf-8')
    
    // Execute migration
    db.exec(migration)
    
    // Record migration
    db.prepare(`
      INSERT INTO migrations (name, applied_at)
      VALUES (?, datetime('now'))
    `).run('011_add_session_status')
    
    console.log('✅ Migration 011 applied successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

applyMigration()
