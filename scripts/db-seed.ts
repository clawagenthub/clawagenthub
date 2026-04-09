#!/usr/bin/env node
/**
 * Database Seed Script
 * Create admin superuser account
 */

import { getDatabase, initializeDatabase } from '../lib/db/index.js'
import { hashPassword } from '../lib/auth/password.js'
import { generateUserId } from '../lib/auth/token.js'
import logger, { logCategories } from '../lib/logger/index.js'

async function seedAdminUser() {
  const db = getDatabase()

  // Check if admin user already exists
  const existing = db
    .prepare('SELECT COUNT(*) as count FROM users WHERE email = ?')
    .get('admin@clawhub.local') as { count: number }

  if (existing.count > 0) {
    logger.info({ category: logCategories.SEEDER }, '⚠️  Admin user already exists')
    logger.info({ category: logCategories.SEEDER }, '   Email: admin@clawhub.local')
    logger.info({ category: logCategories.SEEDER }, '   Password: admin123')
    return
  }

  const userId = generateUserId()
  const email = 'admin@clawhub.local'
  const password = 'admin123'
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  logger.info({ category: logCategories.SEEDER }, '🔐 Creating admin user...')
  logger.debug({ category: logCategories.SEEDER }, `Hashing password: ${password}`)
  logger.debug({ category: logCategories.SEEDER }, `Hash: ${passwordHash.substring(0, 30)}...`)

  db.prepare(
    `INSERT INTO users (id, email, password_hash, is_superuser, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).run(userId, email, passwordHash, now, now)

  logger.info({ category: logCategories.SEEDER }, '✅ Admin user created successfully!')

  // Create Admin Workspace
  const workspaceId = generateUserId() // Reuse the same ID generator
  const workspaceName = 'Admin Workspace'

  logger.info({ category: logCategories.SEEDER }, '🏢 Creating Admin Workspace...')
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

  logger.info({ category: logCategories.SEEDER }, '✅ Admin Workspace created successfully!', { workspace: workspaceName, owner: email })

  logger.info({ category: logCategories.SEEDER }, '📝 Login credentials:', { email, password })
  logger.warn({ category: logCategories.SEEDER }, '⚠️  Change this password in production!')
}

async function main() {
  logger.info({ category: logCategories.SEEDER }, '🌱 Seeding database...')

  try {
    // Ensure database is initialized
    initializeDatabase()

    await seedAdminUser()

    logger.info({ category: logCategories.SEEDER }, '✨ Database seeding complete!')
  } catch (error) {
    logger.error({ category: logCategories.SEEDER }, '❌ Database seeding failed', { error })
    process.exit(1)
  }
}

main()
