#!/usr/bin/env node
/**
 * Database Health Check Script
 * Verify database structure and integrity
 */

import { getDatabase } from '../lib/db/index.js'
import { existsSync } from 'fs'

interface TableInfo {
  name: string
  type: string
  sql: string
}

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

async function main() {
  console.log('🔍 Checking database health...\n')

  try {
    const dbPath = process.env.DATABASE_PATH || './data/clawhub.db'

    // Check if database file exists
    if (!existsSync(dbPath)) {
      console.log('❌ Database file does not exist!')
      console.log(`   Expected location: ${dbPath}`)
      console.log('\n💡 Run: npm run db:init')
      process.exit(1)
    }

    console.log(`✓ Database file exists: ${dbPath}`)

    const db = getDatabase()

    // Check tables
    const tables = db
      .prepare(
        `SELECT name, type, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all() as TableInfo[]

    if (tables.length === 0) {
      console.log('\n❌ No tables found in database!')
      console.log('\n💡 Run: npm run db:init')
      process.exit(1)
    }

    console.log(`✓ Found ${tables.length} tables\n`)

    // Expected tables
    const expectedTables = ['users', 'sessions', 'setup_tokens', 'migrations']
    const foundTables = tables.map((t) => t.name)
    const missingTables = expectedTables.filter((t) => !foundTables.includes(t))

    if (missingTables.length > 0) {
      console.log('⚠️  Missing tables:')
      missingTables.forEach((table) => {
        console.log(`   - ${table}`)
      })
      console.log('\n💡 Run: npm run db:init')
    } else {
      console.log('✅ All expected tables exist')
    }

    // Show table details
    console.log('\n📊 Table Structure:\n')
    for (const table of tables) {
      console.log(`📋 ${table.name}`)

      const columns = db
        .prepare(`PRAGMA table_info(${table.name})`)
        .all() as ColumnInfo[]

      columns.forEach((col) => {
        const nullable = col.notnull ? 'NOT NULL' : 'NULL'
        const pk = col.pk ? ' PRIMARY KEY' : ''
        console.log(`   - ${col.name}: ${col.type} ${nullable}${pk}`)
      })

      // Count rows
      const count = db
        .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
        .get() as { count: number }
      console.log(`   📊 Rows: ${count.count}\n`)
    }

    // Check migrations
    const migrations = db
      .prepare('SELECT name, applied_at FROM migrations ORDER BY id')
      .all() as { name: string; applied_at: string }[]

    console.log('📦 Applied Migrations:')
    if (migrations.length === 0) {
      console.log('   ⚠️  No migrations applied!')
    } else {
      migrations.forEach((migration) => {
        console.log(`   ✓ ${migration.name} (${migration.applied_at})`)
      })
    }

    // Check for superuser
    const superuserCount = db
      .prepare('SELECT COUNT(*) as count FROM users WHERE is_superuser = 1')
      .get() as { count: number }

    console.log('\n👤 Users:')
    const totalUsers = db
      .prepare('SELECT COUNT(*) as count FROM users')
      .get() as { count: number }
    console.log(`   Total: ${totalUsers.count}`)
    console.log(`   Superusers: ${superuserCount.count}`)

    if (superuserCount.count === 0) {
      console.log('\n⚠️  No superuser found!')
      console.log('💡 Run: npm run db:seed --superuser')
      console.log('   Or visit /setup to create one')
    }

    console.log('\n✅ Database health check complete!')
  } catch (error) {
    console.error('\n❌ Database health check failed:')
    console.error(error)
    process.exit(1)
  }
}

main()
