#!/usr/bin/env node
/**
 * Test Login Script
 * Verify password verification works correctly
 */

import { getDatabase, initializeDatabase } from '../lib/db/index.js'
import { verifyPassword } from '../lib/auth/password.js'
import type { User } from '../lib/db/schema.js'

async function testLogin(email: string, password: string) {
  console.log(`\n🔐 Testing login for: ${email}`)
  console.log(`   Password: ${password}`)

  try {
    initializeDatabase()
    const db = getDatabase()

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as User | undefined

    if (!user) {
      console.log('   ❌ User not found')
      return false
    }

    console.log(`   ✓ User found: ${user.id}`)
    console.log(`   Password hash: ${user.password_hash.substring(0, 30)}...`)

    const isValid = await verifyPassword(password, user.password_hash)

    if (isValid) {
      console.log('   ✅ Password is CORRECT')
      return true
    } else {
      console.log('   ❌ Password is INCORRECT')
      return false
    }
  } catch (error) {
    console.error('   ❌ Error:', error)
    return false
  }
}

async function main() {
  console.log('🧪 Testing Login Functionality\n')
  console.log('=' .repeat(50))

  // Test the admin account
  await testLogin('admin@clawhub.local', 'admin123')
  
  // Test with wrong password
  await testLogin('admin@clawhub.local', 'wrongpassword')
  
  // Test other accounts
  await testLogin('user1@test.local', 'password123')
  await testLogin('developer@test.local', 'dev123')

  console.log('\n' + '='.repeat(50))
  console.log('\n✨ Test complete!')
  console.log('\n📝 Correct credentials:')
  console.log('   Email: admin@clawhub.local')
  console.log('   Password: admin123')
}

main()
