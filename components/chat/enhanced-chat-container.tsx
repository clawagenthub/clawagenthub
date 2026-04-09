'use client'

import React, { useState, useEffect, useRef } from 'react'
import { EnhancedChatScreen } from './enhanced-chat-screen'
import { EnhancedSessionsPanel } from './enhanced-sessions-panel'
import { useQueryClient } from '@tanstack/react-query'
import type { ChatSession } from '@/lib/db/schema'
import logger, { logCategories } from '@/lib/logger/index.js'


interface EnhancedChatContainerProps {
  initialSession?: ChatSession
  onSessionChange?: (session: ChatSession | null) => void
}

export function EnhancedChatContainer({ initialSession, onSessionChange }: EnhancedChatContainerProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'sessions'>(
    initialSession ? 'chat' : 'sessions'
  )
  const [currentSession, setCurrentSession] = useState<ChatSession | undefined>(initialSession)
  const queryClient = useQueryClient()
  const previousTabRef = useRef<'chat' | 'sessions' | null>(null)

  // Refetch sessions when switching to sessions tab
  useEffect(() => {
    if (activeTab === 'sessions' && previousTabRef.current !== 'sessions') {
      logger.debug('[EnhancedChatContainer] Switching to sessions tab - refetching sessions')
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    }
    previousTabRef.current = activeTab
  }, [activeTab])

  const handleSessionSelect = (sessionId: string) => {
    // In a real app, you'd fetch the session details here
    // For now, we'll just trigger the session change callback
    if (onSessionChange) {
      onSessionChange(null) // Placeholder - would be actual session
    }
    setActiveTab('chat')
  }

  const handleNewSession = () => {
    setCurrentSession(undefined)
    setActiveTab('sessions')
    if (onSessionChange) {
      onSessionChange(null)
    }
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
      {/* Tab Navigation */}
      <div
        className="flex border-b flex-shrink-0"
        style={{ borderColor: 'rgb(var(--border-color))' }}
      >
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
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
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
        ) : (
          <EnhancedSessionsPanel
            currentSessionId={currentSession?.id}
            onSelectSession={handleSessionSelect}
            onNewSession={handleNewSession}
          />
        )}
      </div>
    </div>
  )
}
