'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'

interface LoginCredentials {
  email: string
  password: string
  origin?: string
}

interface LoginResponse {
  success: boolean
  message?: string
  user?: {
    id: string
    email: string
    is_superuser: boolean
    first_password_changed: boolean
  }
}

async function loginUser(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Login failed')
  }
  
  return response.json()
}

export function useLogin() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // Invalidate and refetch user data after successful login
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me })
      
      // Optionally set the user data immediately (optimistic update)
      if (data.user) {
        queryClient.setQueryData(queryKeys.user.me, data.user)
      }
    },
  })
}
