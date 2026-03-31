'use client'

import { Provider } from 'jotai'
import { ReactNode } from 'react'

interface JotaiProviderProps {
  children: ReactNode
}

/**
 * Jotai Provider component for Next.js App Router
 * 
 * This provider should wrap the entire application at the root level
 * to enable Jotai state management throughout the app.
 * 
 * Usage in app/layout.tsx:
 * <JotaiProvider>
 *   {children}
 * </JotaiProvider>
 */
export function JotaiProvider({ children }: JotaiProviderProps) {
  return <Provider>{children}</Provider>
}
