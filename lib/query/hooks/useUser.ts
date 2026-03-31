'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../keys'

export interface UserInfo {
  id: string
  email: string
  is_superuser: boolean
  first_password_changed: boolean
}

interface UserResponse {
  user: UserInfo | null
}

async function fetchUser(): Promise<UserInfo | null> {
  const response = await fetch('/api/auth/me', {
    credentials: 'include',
  })
  
  if (!response.ok) {
    return null
  }
  
  const data: UserResponse = await response.json()
  return data.user
}

/**
 * Hook to access user data with automatic caching and refetching
 * 
 * TanStack Query automatically handles:
 * - Caching (60 seconds stale time)
 * - Background refetching on window focus
 * - Deduplication of simultaneous requests
 * - Loading and error states
 * 
 * No more infinite loops! 🎉
 */
export function useUser() {
  const query = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: fetchUser,
    // Auto-refetch every 60 seconds (like current behavior)
    refetchInterval: 60 * 1000,
  })

  return {
    user: query.data ?? null,
    isAuthenticated: query.data !== null,
    mustChangePassword: query.data?.is_superuser === true && 
                       query.data?.first_password_changed === false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch, // Manual refresh function
  }
}
