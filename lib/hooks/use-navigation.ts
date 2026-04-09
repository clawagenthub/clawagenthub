'use client'

import { useContext } from 'react'
import { NavigationContext } from '@/lib/contexts/navigation-context'

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}
