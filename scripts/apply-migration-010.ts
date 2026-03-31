import { getDatabase } from '../lib/db/index.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function applyMigration() {
  const db = getDatabase()

  try {
    // Check if migration already applied
    const existing = db
      .prepare('SELECT * FROM migrations WHERE name = ?')
      .get('010_add_chat_tables')

    if (existing) {
      console.log('✅ Migration 010_add_chat_tables already applied')
      return
    }

    console.log('📝 Applying migration 010_add_chat_tables...')

    // Read and execute migration SQL
    const migrationSQL = readFileSync(
      join(__dirname, '../lib/db/migrations/010_add_chat_tables.sql'),
      'utf-8'
    )

    // Execute migration
    db.exec(migrationSQL)

    // Record migration
    db.prepare(
      `INSERT INTO migrations (name, applied_at) VALUES (?, datetime('now'))`
    ).run('010_add_chat_tables')

    console.log('✅ Migration 010_add_chat_tables applied successfully')
    console.log('   - Created chat_sessions table')
    console.log('   - Created chat_messages table')
    console.log('   - Created indexes for performance')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

applyMigration()
  .then(() => {
    console.log('\n✨ Database migration complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error)
    process.exit(1)
  })
