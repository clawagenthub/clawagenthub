'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/lib/query/hooks'
import { useChatSessions } from '@/lib/query/hooks/useChat'
import { EnhancedChatScreen } from '@/components/chat/enhanced-chat-screen'
import { EnhancedSessionsPanel } from '@/components/chat/enhanced-sessions-panel'
import { NewChatPanel } from '@/components/chat/new-chat-panel'
import type { PageContentProps } from './index'

export function ChatPageContent({ user }: PageContentProps) {
  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions()
  
  const [activeTab, setActiveTab] = useState<'chat' | 'sessions' | 'new'>('sessions')
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>()

  // Check URL for session ID
  useEffect(() => {
    const pathParts = window.location.pathname.split('/')
    const sessionId = pathParts[pathParts.length - 1]
    if (sessionId && sessionId !== 'chat' && sessions.length > 0) {
      const session = sessions.find((s: any) => s.id === sessionId)
      if (session) {
        setCurrentSessionId(sessionId)
        setActiveTab('chat')
      }
    }
  }, [sessions])

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setActiveTab('chat')
    // Update URL without full page reload
    window.history.pushState({}, '', `/chat/${sessionId}`)
  }

  const handleStartChat = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setActiveTab('chat')
    window.history.pushState({}, '', `/chat/${sessionId}`)
  }

  const handleNewSession = () => {
    setCurrentSessionId(undefined)
    setActiveTab('new')
  }

  if (sessionsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</div>
      </div>
    )
  }

  const currentSession = currentSessionId 
    ? sessions.find((s: any) => s.id === currentSessionId)
    : undefined

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
      {/* Tab Navigation */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-6 py-4 font-medium transition-all duration-200 ${
            activeTab === 'chat' ? 'border-b-2' : ''
          }`}
          style={{
            color: activeTab === 'chat' ? 'rgb(var(--primary-color, 59 130 246))' : 'rgb(var(--text-secondary))',
            borderColor: activeTab === 'chat' ? 'rgb(var(--primary-color, 59 130 246))' : 'transparent',
          }}
        >
          <span className="flex items-center justify-center gap-2">
            💬 Chat
            {currentSession && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 px-6 py-4 font-medium transition-all duration-200 ${
            activeTab === 'sessions' ? 'border-b-2' : ''
          }`}
          style={{
            color: activeTab === 'sessions' ? 'rgb(var(--primary-color, 59 130 246))' : 'rgb(var(--text-secondary))',
            borderColor: activeTab === 'sessions' ? 'rgb(var(--primary-color, 59 130 246))' : 'transparent',
          }}
        >
          <span className="flex items-center justify-center gap-2">
            📋 Sessions
            {sessions.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                color: 'rgb(var(--text-secondary))'
              }}>
                {sessions.length}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 px-6 py-4 font-medium transition-all duration-200 ${
            activeTab === 'new' ? 'border-b-2' : ''
          }`}
          style={{
            color: activeTab === 'new' ? 'rgb(var(--primary-color, 59 130 246))' : 'rgb(var(--text-secondary))',
            borderColor: activeTab === 'new' ? 'rgb(var(--primary-color, 59 130 246))' : 'transparent',
          }}
        >
          <span className="flex items-center justify-center gap-2">
            ✨ New Chat
          </span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && currentSession ? (
          <EnhancedChatScreen session={currentSession} />
        ) : activeTab === 'chat' && !currentSession ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-md" style={{ color: 'rgb(var(--text-secondary))' }}>
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
                No Active Chat
              </h3>
              <p className="mb-6">
                Select a session from the Sessions tab or create a new one to start chatting.
              </p>
              <button
                onClick={() => setActiveTab('sessions')}
                className="px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: 'rgb(var(--primary-color, 59 130 246))',
                  color: 'white',
                }}
              >
                Browse Sessions
              </button>
            </div>
          </div>
        ) : activeTab === 'sessions' ? (
          <EnhancedSessionsPanel
            currentSessionId={currentSessionId}
            onSelectSession={handleSessionSelect}
            onNewSession={handleNewSession}
          />
        ) : (
          <NewChatPanel onStartChat={handleStartChat} />
        )}
      </div>
    </div>
  )
}
