/**
 * Navigation Context - Manages SPA-style navigation state
 * 
 * Provides reactive navigation without full page reloads.
 * Updates URL and renders content based on current route.
 */

'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export type AppRoute = 'dashboard' | 'chat' | 'statuses' | 'skills' | 'profile' | 'settings'

interface NavigationContextValue {
  currentRoute: AppRoute
  navigateTo: (route: AppRoute) => void
  isActive: (route: AppRoute) => boolean
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('dashboard')

  // Initialize current route from pathname on mount
  useEffect(() => {
    const routeFromPath = getPathnameRoute(pathname)
    setCurrentRoute(routeFromPath)
  }, [pathname])

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const routeFromPath = getPathnameRoute(window.location.pathname)
      setCurrentRoute(routeFromPath)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const navigateTo = (route: AppRoute) => {
    setCurrentRoute(route)
    // Update URL without triggering full page navigation
    const url = getRouteUrl(route)
    window.history.pushState({}, '', url)
  }

  const isActive = (route: AppRoute) => {
    return currentRoute === route
  }

  return (
    <NavigationContext.Provider value={{ currentRoute, navigateTo, isActive }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}

// Helper functions
function getPathnameRoute(pathname: string): AppRoute {
  if (pathname.startsWith('/chat')) return 'chat'
  if (pathname.startsWith('/gateways')) return 'settings'
  if (pathname.startsWith('/statuses')) return 'statuses'
  if (pathname.startsWith('/skills')) return 'skills'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/settings') || pathname.includes('settings')) return 'settings'
  return 'dashboard'
}

function getRouteUrl(route: AppRoute): string {
  switch (route) {
    case 'dashboard':
      return '/dashboard'
    case 'chat':
      return '/chat'
    case 'statuses':
      return '/statuses'
    case 'skills':
      return '/skills'
    case 'profile':
      return '/profile'
    case 'settings':
      return '/settings'
    default:
      return '/dashboard'
  }
}
