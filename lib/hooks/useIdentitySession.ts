'use client'

import { useEffect } from 'react'
import { useIdentityContext } from '@/lib/identity-context.js'

export interface UseIdentitySessionOptions {
  enabled?: boolean
  autoRefreshOnFocus?: boolean
}

export function useIdentitySession(
  options: UseIdentitySessionOptions = {}
) {
  const { enabled = true, autoRefreshOnFocus = true } = options
  const context = useIdentityContext()

  useEffect(() => {
    if (!enabled || !autoRefreshOnFocus) {
      return
    }

    const handleFocus = () => {
      void context.refreshIdentity().catch(() => {
        // context handles error state
      })
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [autoRefreshOnFocus, context, enabled])

  return context
}

export default useIdentitySession
