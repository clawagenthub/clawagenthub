import { atom } from 'jotai'
import { atomWithRefresh } from 'jotai/utils'
import logger, { logCategories } from '@/lib/logger/index.js'


export interface UserInfo {
  id: string
  email: string
  is_superuser: boolean
  first_password_changed: boolean
}

/**
 * Base atom that fetches user data from /api/auth/me
 * This atom uses atomWithRefresh to allow manual refresh capability
 * The useUser hook will set up auto-refresh every 60 seconds
 */
export const userAtom = atomWithRefresh(async (get) => {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.user as UserInfo | null
  } catch (error) {
    logger.error('[userAtom] Error fetching user:', error)
    return null
  }
})

/**
 * Derived atom to check if user is authenticated
 * Since userAtom is async, this must also be async
 */
export const isAuthenticatedAtom = atom(async (get) => {
  const user = await get(userAtom)
  return user !== null
})

/**
 * Derived atom to check if password change is required
 * Returns true if user is superuser and hasn't changed their first password
 */
export const mustChangePasswordAtom = atom(async (get) => {
  const user = await get(userAtom)
  return user?.is_superuser === true && user?.first_password_changed === false
})
