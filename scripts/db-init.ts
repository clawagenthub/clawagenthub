#!/usr/bin/env node
/**
 * Database Initialization Script
 * Manually initialize the database and run all migrations
 */

import { initializeDatabase, getDatabase } from '../lib/db/index.js'

async function main() {
  console.log('🚀 Starting database initialization...\n')

  try {
    // Initialize database and run migrations
    initializeDatabase()

    // Verify tables were created
    const db = getDatabase()
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      )
      .all() as { name: string }[]

    console.log('\n✅ Database initialized successfully!')
    console.log('\n📊 Tables created:')
    tables.forEach((table) => {
      console.log(`   - ${table.name}`)
    })

    // Show migration status
    const migrations = db
      .prepare('SELECT name, applied_at FROM migrations ORDER BY id')
      .all() as { name: string; applied_at: string }[]

    console.log('\n📦 Migrations applied:')
    migrations.forEach((migration) => {
      console.log(`   - ${migration.name} (${migration.applied_at})`)
    })

    console.log('\n✨ Database is ready to use!')
  } catch (error) {
    console.error('\n❌ Database initialization failed:')
    console.error(error)
    process.exit(1)
  }
}

main()
