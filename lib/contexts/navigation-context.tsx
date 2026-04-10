/**
 * Navigation Context - Manages SPA-style navigation state
 *
 * Provides reactive navigation without full page reloads.
 * Updates URL and renders content based on current route.
 */

'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, ReactNode } from 'react'
import { AppRoute } from '@/lib/types/navigation-types'
import { NavigationContext } from './navigation-context-object'

export { NavigationContext }

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
    const url = getRouteUrl(route)
    // Use router.push to let Next.js handle navigation properly
    // This ensures usePathname() updates and useEffect([pathname]) syncs state correctly
    router.push(url)
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

// Helper functions (not exported - internal to this module)
function getPathnameRoute(pathname: string): AppRoute {
  if (pathname.startsWith('/chat')) return 'chat'
  if (pathname.startsWith('/statuses')) return 'statuses'
  if (pathname.startsWith('/skills')) return 'skills'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/gateways')) return 'settings'
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
