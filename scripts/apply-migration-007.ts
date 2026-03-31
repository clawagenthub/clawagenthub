import { getDatabase } from '../lib/db/index.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function applyMigration() {
  try {
    const db = getDatabase()

    // Check if migration already applied
    const existing = db
      .prepare('SELECT * FROM migrations WHERE name = ?')
      .get('007_add_pairing_status')

    if (existing) {
      console.log('Migration 007_add_pairing_status already applied')
      return
    }

    // Read and execute migration
    const migrationSQL = readFileSync(
      join(__dirname, '../lib/db/migrations/007_add_pairing_status.sql'),
      'utf-8'
    )

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const statement of statements) {
      db.exec(statement)
    }

    // Record migration
    db.prepare(
      'INSERT INTO migrations (name, applied_at) VALUES (?, ?)'
    ).run('007_add_pairing_status', new Date().toISOString())

    console.log('✅ Migration 007_add_pairing_status applied successfully')
  } catch (error) {
    console.error('❌ Failed to apply migration:', error)
    process.exit(1)
  }
}

applyMigration()
