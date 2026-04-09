'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/query/hooks'
import { useChatSessions } from '@/lib/query/hooks/useChat'
import logger, { logCategories } from '@/lib/logger/index.js'


// Import components dynamically to avoid build issues
const ReactiveDashboardLayout = require('@/components/layout/reactive-dashboard-layout').ReactiveDashboardLayout
const EnhancedChatScreen = require('@/components/chat/enhanced-chat-screen').EnhancedChatScreen

export default function ChatSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter()
  // In Next.js 15+, params is a Promise that needs to be awaited
  const { sessionId } = use(params)
  
  // Simple loading state - no complex error handling that could fail
  const [isReady, setIsReady] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  
  const { user, isLoading: userLoading } = useUser()
  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  // Check if session exists and redirect if not
  useEffect(() => {
    if (!userLoading && !sessionsLoading && user) {
      logger.debug('[Chat Session Page] Looking for session:', sessionId)
      logger.debug('[Chat Session Page] Available sessions:', sessions.map((s: any) => ({ id: s.id, title: s.title || 'New Chat' })))
      
      const session = sessions.find((s: any) => s.id === sessionId)
      
      if (!session) {
        logger.error('[Chat Session Page] Session not found! Looking for:', sessionId, 'but got sessions:', sessions.map((s: any) => s.id))
        // Session not found - redirect to chat page
        setRedirecting(true)
        // Use a small toast notification and redirect
        if (typeof window !== 'undefined' && (window as any).toast) {
          ;(window as any).toast('Session not found', { type: 'error' })
        }
        router.push('/chat')
        return
      }
      
      logger.debug('[Chat Session Page] Session found:', session.id)
      setIsReady(true)
    }
  }, [user, userLoading, sessionsLoading, sessions, sessionId, router])

  // Show loading state
  if (redirecting || !isReady) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#ffffff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            {redirecting ? 'Redirecting...' : 'Loading...'}
          </p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Find the session again (it should exist now)
  const session = sessions.find((s: any) => s.id === sessionId)
  
  // Double-check - if somehow session is still null, redirect
  if (!session) {
    router.push('/chat')
    return null
  }

  return (
    <ReactiveDashboardLayout user={user} noPadding>
      <div style={{ height: '100%', backgroundColor: '#ffffff' }}>
        <EnhancedChatScreen session={session} />
      </div>
    </ReactiveDashboardLayout>
  )
}
