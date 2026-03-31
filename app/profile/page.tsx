'use client'

import { useUser } from '@/lib/query/hooks'
import { ReactiveDashboardLayout } from '@/components/layout/reactive-dashboard-layout'

export default function ProfilePage() {
  // This page now uses reactive navigation
  // The actual content is rendered by the ProfilePageContent component
  const { user, isLoading } = useUser()

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
