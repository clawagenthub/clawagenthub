#!/usr/bin/env node
/**
 * Database Password Fix Script
 * Check and fix unhashed passwords in the database
 */

import { getDatabase, initializeDatabase } from '../lib/db/index.js'
import { hashPassword, verifyPassword } from '../lib/auth/password.js'
import type { User } from '../lib/db/schema.js'

async function checkAndFixPasswords() {
  console.log('🔍 Checking database passwords...\n')

  try {
    initializeDatabase()
    const db = getDatabase()

    const users = db.prepare('SELECT * FROM users').all() as User[]

    if (users.length === 0) {
      console.log('⚠️  No users found in database')
      console.log('💡 Run: npm run db:seed')
      return
    }

    console.log(`Found ${users.length} user(s):\n`)

    for (const user of users) {
      console.log(`📧 ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Superuser: ${user.is_superuser ? 'Yes' : 'No'}`)
      console.log(`   Password Hash: ${user.password_hash.substring(0, 20)}...`)

      // Check if password looks like a bcrypt hash
      const isBcryptHash = user.password_hash.startsWith('$2a$') || 
                          user.password_hash.startsWith('$2b$') || 
                          user.password_hash.startsWith('$2y$')

      if (!isBcryptHash) {
        console.log(`   ⚠️  WARNING: Password does not appear to be hashed!`)
        console.log(`   🔧 Attempting to fix...`)

        // Assume the stored value is the plain password and hash it
        const plainPassword = user.password_hash
        const hashedPassword = await hashPassword(plainPassword)

        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
          hashedPassword,
          user.id
        )

        console.log(`   ✅ Password has been hashed`)
        console.log(`   📝 Login with: ${user.email} / ${plainPassword}`)
      } else {
        console.log(`   ✅ Password is properly hashed`)

        // Try to verify with common test passwords
        const testPasswords = ['admin123', 'password123', 'dev123']
        for (const testPass of testPasswords) {
          const isValid = await verifyPassword(testPass, user.password_hash)
          if (isValid) {
            console.log(`   📝 Login with: ${user.email} / ${testPass}`)
            break
          }
        }
      }

      console.log()
    }

    console.log('✨ Password check complete!')
  } catch (error) {
    console.error('\n❌ Error checking passwords:')
    console.error(error)
    process.exit(1)
  }
}

checkAndFixPasswords()
