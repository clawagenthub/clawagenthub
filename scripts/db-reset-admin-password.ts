#!/usr/bin/env node
/**
 * Reset admin user password script
 * Sets admin@clawhub.local password to admin123
 */

import { initializeDatabase, getDatabase } from '../lib/db/index.js'
import { hashPassword } from '../lib/auth/password.js'

async function main() {
  const targetEmail = 'admin@clawhub.local'
  const newPassword = 'admin123'

  console.log('🔐 Resetting admin password...\n')

  try {
    initializeDatabase()
    const db = getDatabase()

    const existingUser = db
      .prepare('SELECT id, email, is_superuser FROM users WHERE email = ?')
      .get(targetEmail) as
      | { id: string; email: string; is_superuser: number | boolean }
      | undefined

    if (!existingUser) {
      console.error(`❌ User not found: ${targetEmail}`)
      console.error('💡 Run: npm run db:seed')
      process.exit(1)
    }

    const passwordHash = await hashPassword(newPassword)

    db.prepare(
      `UPDATE users
       SET password_hash = ?,
           first_password_changed = 0,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(passwordHash, existingUser.id)

    console.log('✅ Admin password reset successfully!')
    console.log(`   Email: ${targetEmail}`)
    console.log(`   Password: ${newPassword}`)
    console.log('   first_password_changed: 0 (password change required on next login)')
  } catch (error) {
    console.error('\n❌ Failed to reset admin password:')
    console.error(error)
    process.exit(1)
  }
}

main()

