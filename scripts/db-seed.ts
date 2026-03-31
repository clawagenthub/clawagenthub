#!/usr/bin/env node
/**
 * Database Seed Script
 * Create admin superuser account
 */

import { getDatabase, initializeDatabase } from '../lib/db/index.js'
import { hashPassword } from '../lib/auth/password.js'
import { generateUserId } from '../lib/auth/token.js'

async function seedAdminUser() {
  const db = getDatabase()

  // Check if admin user already exists
  const existing = db
    .prepare('SELECT COUNT(*) as count FROM users WHERE email = ?')
    .get('admin@clawhub.local') as { count: number }

  if (existing.count > 0) {
    console.log('⚠️  Admin user already exists')
    console.log('   Email: admin@clawhub.local')
    console.log('   Password: admin123')
    return
  }

  const userId = generateUserId()
  const email = 'admin@clawhub.local'
  const password = 'admin123'
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  console.log('🔐 Creating admin user...')
  console.log(`   Hashing password: ${password}`)
  console.log(`   Hash: ${passwordHash.substring(0, 30)}...`)

  db.prepare(
    `INSERT INTO users (id, email, password_hash, is_superuser, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).run(userId, email, passwordHash, now, now)

  console.log('✅ Admin user created successfully!')

  // Create Admin Workspace
  const workspaceId = generateUserId() // Reuse the same ID generator
  const workspaceName = 'Admin Workspace'

  console.log('\n🏢 Creating Admin Workspace...')
  db.prepare(
    `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(workspaceId, workspaceName, userId, now, now)

  // Add admin user as owner member
  const memberId = generateUserId()
  db.prepare(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
     VALUES (?, ?, ?, 'owner', ?)`
  ).run(memberId, workspaceId, userId, now)

  console.log('✅ Admin Workspace created successfully!')
  console.log(`   Workspace: ${workspaceName}`)
  console.log(`   Owner: ${email}`)

  console.log('\n📝 Login credentials:')
  console.log(`   Email: ${email}`)
  console.log(`   Password: ${password}`)
  console.log('\n⚠️  Change this password in production!')
}

async function main() {
  console.log('🌱 Seeding database...\n')

  try {
    // Ensure database is initialized
    initializeDatabase()

    await seedAdminUser()

    console.log('\n✨ Database seeding complete!')
  } catch (error) {
    console.error('\n❌ Database seeding failed:')
    console.error(error)
    process.exit(1)
  }
}

main()
