#!/usr/bin/env node
/**
 * Database Migration Script
 * Run pending database migrations
 */

import { runMigrations, getDatabase } from '../lib/db/index.js'

async function main() {
  console.log('🔄 Running database migrations...\n')

  try {
    // Run migrations
    runMigrations()

    // Show migration status
    const db = getDatabase()
    const migrations = db
      .prepare('SELECT name, applied_at FROM migrations ORDER BY id')
      .all() as { name: string; applied_at: string }[]

    console.log('\n✅ Migrations completed successfully!')
    console.log('\n📦 Applied migrations:')
    migrations.forEach((migration) => {
      console.log(`   - ${migration.name} (${migration.applied_at})`)
    })

    console.log(`\n✨ Total migrations applied: ${migrations.length}`)
  } catch (error) {
    console.error('\n❌ Migration failed:')
    console.error(error)
    process.exit(1)
  }
}

main()
