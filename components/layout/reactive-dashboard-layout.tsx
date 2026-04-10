'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { NavigationProvider } from '@/lib/contexts/navigation-context'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { getPageContentComponent, PageContentProps } from '@/components/pages'
import { useUser } from '@/lib/query/hooks'

interface UserInfo {
  id: string
  email: string
  is_superuser: boolean
}

interface ReactiveDashboardLayoutProps {
  user: UserInfo
  noPadding?: boolean
}

/**
 * Internal component that uses the navigation context
 */
function ReactiveDashboardContent({ noPadding }: ReactiveDashboardLayoutProps) {
  const router = useRouter()
  const { currentRoute } = useNavigation()
  const { user: userData, isLoading, mustChangePassword } = useUser()
  
  const [_isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  // Simple auth check - TanStack Query handles all refetching logic
  useEffect(() => {
    if (!isLoading && userData === null) {
      router.push('/login')
    }
    
    if (mustChangePassword) {
      setIsPasswordModalOpen(true)
    }
  }, [userData, mustChangePassword, isLoading, router])

  // Show loading state while user data is being fetched
  if (isLoading || !userData) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: `rgb(var(--bg-primary))` }}
      >
        <div style={{ color: `rgb(var(--text-secondary))` }}>Loading...</div>
      </div>
    )
  }

  // Get the appropriate content component for the current route
  const PageContent = getPageContentComponent(currentRoute)
  const pageContentProps: PageContentProps = { user: userData }

  // Dashboard gets no padding and full height for grid layout
  const isDashboard = currentRoute === 'dashboard'
  const mainPadding = isDashboard ? 'p-6' : (noPadding ? '' : 'p-8')

  return (
    <div
      className="flex h-screen"
      style={{ backgroundColor: `rgb(var(--bg-secondary))` }}
    >
      <Sidebar user={userData} />
      <main
        className={`flex-1 flex flex-col overflow-hidden ${mainPadding}`}
        style={{ color: `rgb(var(--text-primary))` }}
      >
        <PageContent key={router.asPath} {...pageContentProps} />
      </main>
    </div>
  )
}

/**
 * Reactive Dashboard Layout - Provides SPA-style navigation
 * 
 * This layout wraps the application with the NavigationProvider
 * and renders content reactively based on the current route.
 */
export function ReactiveDashboardLayout({ user, noPadding }: ReactiveDashboardLayoutProps) {
  return (
    <NavigationProvider>
      <ReactiveDashboardContent user={user} noPadding={noPadding} />
    </NavigationProvider>
  )
}
