'use client'

import { useUser } from '@/lib/query/hooks'
import { useChatSessions } from '@/lib/query/hooks/useChat'
import { ReactiveDashboardLayout } from '@/components/layout/reactive-dashboard-layout'

export default function ChatPage() {
  // This page now uses reactive navigation
  // The actual content is rendered by the ChatPageContent component
  const { user, isLoading: userLoading } = useUser()
  const { isLoading: sessionsLoading } = useChatSessions()

  if (userLoading || sessionsLoading || !user) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return <ReactiveDashboardLayout user={user} noPadding />
}
