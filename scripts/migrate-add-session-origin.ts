import { getDatabase } from '../lib/db/index.js'

const db = getDatabase()

console.log('🔄 Running migration: Add session origin...')

try {
  // Add origin column to sessions table
  db.exec(`
    ALTER TABLE sessions ADD COLUMN origin TEXT;
  `)
  
  console.log('✅ Added origin column to sessions table')
  
  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_origin ON sessions(origin);
  `)
  
  console.log('✅ Created index on origin column')
  console.log('✅ Migration completed successfully')
} catch (error) {
  if (error instanceof Error && error.message.includes('duplicate column name')) {
    console.log('ℹ️  Origin column already exists, skipping migration')
  } else {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}
