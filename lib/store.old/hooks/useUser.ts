'use client'

import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { userAtom, isAuthenticatedAtom, mustChangePasswordAtom } from '../atoms/userAtom'
import logger, { logCategories } from '@/lib/logger/index.js'


const REFRESH_INTERVAL = 60000 // 60 seconds (1 minute)

/**
 * Hook to access user data with automatic refresh every minute
 * 
 * This hook:
 * - Fetches user data on mount
 * - Auto-refreshes every 60 seconds to keep session alive
 * - Provides derived states (isAuthenticated, mustChangePassword)
 * - Allows manual refresh via refreshUser()
 * 
 * The auto-refresh prevents the infinite loop issue by:
 * 1. Using a controlled interval instead of useEffect dependencies
 * 2. Centralizing state management in Jotai atoms
 * 3. Avoiding state updates that trigger re-fetches
 */
export function useUser() {
  const [user, refreshUser] = useAtom(userAtom)
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const mustChangePassword = useAtomValue(mustChangePasswordAtom)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Set up auto-refresh interval
    // This will refresh user data every minute to keep session fresh
    // and detect any changes (like password updates or permission changes)
    intervalRef.current = setInterval(() => {
      logger.debug('[useUser] Auto-refreshing user data...')
      refreshUser()
    }, REFRESH_INTERVAL)

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refreshUser])

  return {
    user,
    isAuthenticated,
    mustChangePassword,
    refreshUser, // Manual refresh function for immediate updates
  }
}

/**
 * Lightweight hook for components that only need to trigger user refresh
 * without subscribing to user data changes
 */
export function useRefreshUser() {
  const [, refreshUser] = useAtom(userAtom)
  return refreshUser
}
