'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'

interface ChangePasswordData {
  currentPassword: string
  newPassword: string
}

interface ChangePasswordResponse {
  success: boolean
  message: string
}

async function changePassword(data: ChangePasswordData): Promise<ChangePasswordResponse> {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Password change failed')
  }
  
  return response.json()
}

export function useChangePassword() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      // Refetch user data to get updated first_password_changed flag
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me })
    },
  })
}
