'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'

async function logoutUser(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
  
  if (!response.ok) {
    throw new Error('Logout failed')
  }
}

export function useLogout() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear()
    },
  })
}
