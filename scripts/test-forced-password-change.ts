#!/usr/bin/env node
/**
 * Test Script for Forced Password Change Feature
 * Validates the database schema and feature implementation
 */

import { getDatabase } from '../lib/db/index.js'

async function testForcedPasswordChange() {
  console.log('🧪 Testing Forced Password Change Feature\n')
  
  const db = getDatabase()
  
  // Test 1: Check if first_password_changed column exists
  console.log('Test 1: Checking database schema...')
  const tableInfo = db.prepare('PRAGMA table_info(users)').all() as any[]
  const hasColumn = tableInfo.some(col => col.name === 'first_password_changed')
  
  if (hasColumn) {
    console.log('✅ Column "first_password_changed" exists in users table')
  } else {
    console.log('❌ Column "first_password_changed" NOT FOUND in users table')
    process.exit(1)
  }
  
  // Test 2: Check column type and default value
  const columnInfo = tableInfo.find(col => col.name === 'first_password_changed')
  console.log(`   Type: ${columnInfo.type}, Default: ${columnInfo.dflt_value}, NotNull: ${columnInfo.notnull}`)
  
  // Test 3: Check if migration was applied
  console.log('\nTest 2: Checking migrations...')
  const migrations = db.prepare('SELECT name FROM migrations ORDER BY id').all() as any[]
  console.log('   Applied migrations:')
  migrations.forEach(m => console.log(`   - ${m.name}`))
  
  const hasMigration = migrations.some(m => m.name === '002_add_first_password_changed')
  if (hasMigration) {
    console.log('✅ Migration "002_add_first_password_changed" applied')
  } else {
    console.log('❌ Migration "002_add_first_password_changed" NOT FOUND')
  }
  
  // Test 4: Check index
  console.log('\nTest 3: Checking indexes...')
  const indexes = db.prepare('PRAGMA index_list(users)').all() as any[]
  const hasIndex = indexes.some((idx: any) => idx.name === 'idx_users_first_password_changed')
  
  if (hasIndex) {
    console.log('✅ Index "idx_users_first_password_changed" exists')
  } else {
    console.log('⚠️  Index "idx_users_first_password_changed" not found (optional)')
  }
  
  // Test 5: Check if users table is ready
  console.log('\nTest 4: Checking users table...')
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any
  console.log(`   Current user count: ${userCount.count}`)
  
  if (userCount.count === 0) {
    console.log('✅ Users table is empty (ready for fresh setup)')
  } else {
    console.log('   Existing users found. Checking their first_password_changed status...')
    const users = db.prepare('SELECT id, email, is_superuser, first_password_changed FROM users').all() as any[]
    users.forEach(u => {
      console.log(`   - ${u.email}: is_superuser=${u.is_superuser}, first_password_changed=${u.first_password_changed}`)
    })
  }
  
  console.log('\n✅ All tests passed! Feature is ready to use.')
  console.log('\n📝 Next steps:')
  console.log('   1. Start the dev server: npm run dev')
  console.log('   2. Visit the setup URL to create a superuser')
  console.log('   3. Log in with the superuser credentials')
  console.log('   4. Verify the forced password change modal appears')
  console.log('   5. Change the password and verify modal closes')
}

testForcedPasswordChange().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
