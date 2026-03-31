/**
 * Database Middleware
 * Ensures database is initialized before handling requests
 */

import { getDatabase, initializeDatabase } from './index.js'
import type { CountResult } from './schema.d.js'

let isInitialized = false
let initializationPromise: Promise<void> | null = null

/**
 * Check if database tables exist
 */
function tablesExist(): boolean {
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
 * Ensure database is initialized
 * This is safe to call multiple times - it will only initialize once
 */
export async function ensureDatabase(): Promise<void> {
  // If already initialized, return immediately
  if (isInitialized) {
    return
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      console.log('🔍 Checking database status...')

      // Check if tables exist
      if (!tablesExist()) {
        console.log('⚠️  Database tables not found, initializing...')
        initializeDatabase()
      } else {
        console.log('✓ Database tables exist')
      }

      isInitialized = true
      console.log('✓ Database ready')
    } catch (error) {
      console.error('❌ Database initialization failed:', error)
      throw error
    } finally {
      initializationPromise = null
    }
  })()

  return initializationPromise
}

/**
 * Reset initialization state (useful for testing)
 */
export function resetInitializationState(): void {
  isInitialized = false
  initializationPromise = null
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return isInitialized
}
