'use client'

import React, { useState } from 'react'
import { ChatScreen } from './chat-screen'
import { SessionsPanel } from './sessions-panel'
import type { ChatSession } from '@/lib/db/schema'

interface ChatContainerProps {
  session?: ChatSession
}

export function ChatContainer({ session }: ChatContainerProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'sessions'>(
    session ? 'chat' : 'sessions'
  )

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
      {/* Tab Navigation */}
      <div
        className="flex border-b"
        style={{ borderColor: 'rgb(var(--border-color))' }}
      >
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-6 py-4 font-medium transition-colors ${
            activeTab === 'chat' ? 'border-b-2' : ''
          }`}
          style={{
            color: activeTab === 'chat' ? 'rgb(var(--primary-color, 59 130 246))' : 'rgb(var(--text-secondary))',
            borderColor: activeTab === 'chat' ? 'rgb(var(--primary-color, 59 130 246))' : 'transparent',
          }}
          disabled={!session}
        >
          💬 Chat
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 px-6 py-4 font-medium transition-colors ${
            activeTab === 'sessions' ? 'border-b-2' : ''
          }`}
          style={{
            color: activeTab === 'sessions' ? 'rgb(var(--primary-color, 59 130 246))' : 'rgb(var(--text-secondary))',
            borderColor: activeTab === 'sessions' ? 'rgb(var(--primary-color, 59 130 246))' : 'transparent',
          }}
        >
          📋 Sessions
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && session ? (
          <ChatScreen session={session} />
        ) : activeTab === 'chat' && !session ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center" style={{ color: 'rgb(var(--text-secondary))' }}>
              <div className="text-4xl mb-4">💬</div>
              <p className="text-lg font-medium mb-2">No session selected</p>
              <p className="text-sm">Switch to Sessions tab to select or create a chat</p>
            </div>
          </div>
        ) : (
          <SessionsPanel currentSessionId={session?.id} />
        )}
      </div>
    </div>
  )
}
