'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SessionCard } from './session-card'
import { useChatSessions } from '@/lib/query/hooks/useChat'
import type { ChatSession } from '@/lib/db/schema'

interface SessionsPanelProps {
  currentSessionId?: string
}

export function SessionsPanel({ currentSessionId }: SessionsPanelProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const { data: sessions = [], isLoading } = useChatSessions()

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions

    const query = searchQuery.toLowerCase()
    return sessions.filter((session: ChatSession) => {
      return (
        session.title?.toLowerCase().includes(query) ||
        session.agent_name.toLowerCase().includes(query) ||
        session.id.toLowerCase().includes(query)
      )
    })
  }, [sessions, searchQuery])

  const handleNewSession = () => {
    router.push('/chat')
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div style={{ color: 'rgb(var(--text-secondary))' }}>
          Loading sessions...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
            }}
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>
            {searchQuery ? (
              <>
                <div className="text-4xl mb-2">🔍</div>
                <p>No sessions found matching "{searchQuery}"</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-2">💬</div>
                <p>No chat sessions yet</p>
                <p className="text-sm mt-1">Create a new session to get started</p>
              </>
            )}
          </div>
        ) : (
          filteredSessions.map((session: ChatSession) => (
            <SessionCard
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
            />
          ))
        )}
      </div>

      {/* New Session Button */}
      <div className="p-4 border-t" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <button
          onClick={handleNewSession}
          className="w-full px-4 py-3 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: 'rgb(var(--primary-color, 59 130 246))',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          ➕ New Session
        </button>
      </div>
    </div>
  )
}
