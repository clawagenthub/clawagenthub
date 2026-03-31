'use client'

import { useUser } from '@/lib/query/hooks'
import { ReactiveDashboardLayout } from '@/components/layout/reactive-dashboard-layout'

export default function DashboardPage() {
  // This page now uses reactive navigation
  // The actual content is rendered by the DashboardPageContent component
  const { user, isLoading } = useUser()

  // Show loading state while user data is being fetched
  if (isLoading || !user) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: `rgb(var(--bg-primary))` }}
      >
        <div style={{ color: `rgb(var(--text-secondary))` }}>Loading...</div>
      </div>
    )
  }

  return <ReactiveDashboardLayout user={user} />
}
