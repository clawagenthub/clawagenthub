#!/usr/bin/env node
/**
 * Database Reset Script
 * Drop all tables and reinitialize the database
 */

import { getDatabase, initializeDatabase, closeDatabase } from '../lib/db/index.js'
import { unlinkSync, existsSync } from 'fs'

async function main() {
  console.log('⚠️  WARNING: This will delete all data in the database!')
  console.log('🗑️  Resetting database...\n')

  try {
    const dbPath = process.env.DATABASE_PATH || './data/clawhub.db'

    // Close any existing connection
    closeDatabase()

    // Delete database files
    if (existsSync(dbPath)) {
      unlinkSync(dbPath)
      console.log('✓ Deleted database file')
    }
    if (existsSync(`${dbPath}-shm`)) {
      unlinkSync(`${dbPath}-shm`)
      console.log('✓ Deleted shared memory file')
    }
    if (existsSync(`${dbPath}-wal`)) {
      unlinkSync(`${dbPath}-wal`)
      console.log('✓ Deleted write-ahead log file')
    }

    console.log('\n🚀 Reinitializing database...\n')

    // Reinitialize
    initializeDatabase()

    // Verify
    const db = getDatabase()
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      )
      .all() as { name: string }[]

    console.log('\n✅ Database reset complete!')
    console.log('\n📊 Tables created:')
    tables.forEach((table) => {
      console.log(`   - ${table.name}`)
    })

    console.log('\n✨ Database is ready for fresh data!')
  } catch (error) {
    console.error('\n❌ Database reset failed:')
    console.error(error)
    process.exit(1)
  }
}

main()
