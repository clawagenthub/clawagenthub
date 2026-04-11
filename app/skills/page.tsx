'use client'

import { useUser } from '@/lib/query/hooks'
import { ReactiveDashboardLayout } from '@/components/layout/reactive-dashboard-layout'

export default function SkillsPage() {
  // This page now uses reactive navigation
  // The actual content is rendered by the SkillsPageContent component
  const { user, isLoading: userLoading } = useUser()

  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return <ReactiveDashboardLayout user={user} />
}
