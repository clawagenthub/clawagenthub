/**
 * Database Health Check Utilities
 * Functions to verify database integrity and status
 */

import { getDatabase } from './index.js'
import type { CountResult, TableInfo } from './schema.d.js'

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean
  tables: string[]
  missingTables: string[]
  userCount: number
  superuserCount: number
  migrationCount: number
  errors: string[]
}

/**
 * Expected database tables
 */
const EXPECTED_TABLES = ['users', 'sessions', 'setup_tokens', 'migrations']

/**
 * Perform comprehensive database health check
 */
export function checkDatabaseHealth(): HealthCheckResult {
  const result: HealthCheckResult = {
    healthy: true,
    tables: [],
    missingTables: [],
    userCount: 0,
    superuserCount: 0,
    migrationCount: 0,
    errors: [],
  }

  try {
    const db = getDatabase()

    // Check tables
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      )
      .all() as TableInfo[]

    result.tables = tables.map((t) => t.name)
    result.missingTables = EXPECTED_TABLES.filter(
      (t) => !result.tables.includes(t)
    )

    if (result.missingTables.length > 0) {
      result.healthy = false
      result.errors.push(
        `Missing tables: ${result.missingTables.join(', ')}`
      )
    }

    // Check user counts (only if users table exists)
    if (result.tables.includes('users')) {
      try {
        const userCount = db
          .prepare('SELECT COUNT(*) as count FROM users')
          .get() as CountResult
        result.userCount = userCount.count

        const superuserCount = db
          .prepare('SELECT COUNT(*) as count FROM users WHERE is_superuser = 1')
          .get() as CountResult
        result.superuserCount = superuserCount.count
      } catch (error) {
        result.errors.push(`Failed to count users: ${error}`)
      }
    }

    // Check migration count (only if migrations table exists)
    if (result.tables.includes('migrations')) {
      try {
        const migrationCount = db
          .prepare('SELECT COUNT(*) as count FROM migrations')
          .get() as CountResult
        result.migrationCount = migrationCount.count
      } catch (error) {
        result.errors.push(`Failed to count migrations: ${error}`)
      }
    }
  } catch (error) {
    result.healthy = false
    result.errors.push(`Database health check failed: ${error}`)
  }

  return result
}

/**
 * Quick check if database is ready
 */
export function isDatabaseReady(): boolean {
  try {
    const db = getDatabase()
    const result = db
      .prepare(
        `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='users'`
      )
      .get() as CountResult

    return result.count > 0
  } catch (error) {
    return false
  }
}

/**
 * Check if superuser exists
 */
export function hasSuperuser(): boolean {
  try {
    const db = getDatabase()
    const result = db
      .prepare('SELECT COUNT(*) as count FROM users WHERE is_superuser = 1')
      .get() as CountResult

    return result.count > 0
  } catch (error) {
    return false
  }
}
