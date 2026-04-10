'use client'

import React, { useState, useMemo } from 'react'
import { SessionCard as _SessionCard } from './session-card'
import { useChatSessions } from '@/lib/query/hooks/useChat'
import { useSessionStatus } from '@/lib/hooks/useSessionStatus'
import { SessionStatusIndicator } from './session-status-indicator'
import type { ChatSession } from '@/lib/db/schema'
import type { SessionStatus, SessionStatusType } from '@/lib/session/status-tracker'

interface EnhancedSessionsPanelProps {
  currentSessionId?: string
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
}

type GroupedSessions = {
  today: ChatSession[]
  yesterday: ChatSession[]
  thisWeek: ChatSession[]
  older: ChatSession[]
}

const isToday = (date: Date) => {
  const today = new Date()
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear()
}

const isYesterday = (date: Date) => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return date.getDate() === yesterday.getDate() &&
         date.getMonth() === yesterday.getMonth() &&
         date.getFullYear() === yesterday.getFullYear()
}

const isThisWeek = (date: Date) => {
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  return date > weekAgo && !isToday(date) && !isYesterday(date)
}

export function EnhancedSessionsPanel({ currentSessionId, onSelectSession, onNewSession }: EnhancedSessionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyRecent, setShowOnlyRecent] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['today', 'yesterday']))
  const { data: sessions = [], isLoading } = useChatSessions()
  const { getStatus, getLiveCount } = useSessionStatus()

  // Filter and group sessions
  const filteredSessions = useMemo(() => {
    let result = sessions

    // Apply 1-hour filter
    if (showOnlyRecent) {
      const oneHourAgo = Date.now() - 3600000
      result = result.filter((s: ChatSession) => {
        const status = getStatus(s.id)
        const lastActivity = status?.lastActivity || new Date(s.updated_at).getTime()
        return lastActivity > oneHourAgo
      })
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((session: ChatSession) => {
        return (
          session.title?.toLowerCase().includes(query) ||
          session.agent_name.toLowerCase().includes(query) ||
          session.id.toLowerCase().includes(query)
        )
      })
    }

    return result
  }, [sessions, searchQuery, showOnlyRecent, getStatus])

  const groupedSessions = useMemo(() => {
    const groups: GroupedSessions = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    }

    filteredSessions.forEach((session: ChatSession) => {
      const date = new Date(session.updated_at)
      if (isToday(date)) {
        groups.today.push(session)
      } else if (isYesterday(date)) {
        groups.yesterday.push(session)
      } else if (isThisWeek(date)) {
        groups.thisWeek.push(session)
      } else {
        groups.older.push(session)
      }
    })

    return groups
  }, [filteredSessions])

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  const handleSessionClick = (sessionId: string) => {
    onSelectSession(sessionId)
  }

  const totalSessions = filteredSessions.length
  const heartbeatActiveSessions = filteredSessions.filter((s) => s.status === 'active').length
  const liveSessions = getLiveCount()

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div style={{ color: 'rgb(var(--text-secondary))' }}>
            Loading sessions...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Stats */}
      <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Sessions
          </h2>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {liveSessions} live
            </span>
            <span className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              {heartbeatActiveSessions} active
            </span>
            <span>{totalSessions} total</span>
          </div>
        </div>

        {/* Search Bar and Filters */}
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search sessions by title, agent, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border"
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                borderColor: 'rgb(var(--border-color))',
                color: 'rgb(var(--text-primary))',
              }}
            />
          </div>
          
          {/* 1-Hour Filter Toggle */}
          <label className="flex items-center gap-2 cursor-pointer px-1">
            <input
              type="checkbox"
              checked={showOnlyRecent}
              onChange={(e) => setShowOnlyRecent(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
              Last 1 hour only
            </span>
          </label>
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 px-4" style={{ color: 'rgb(var(--text-secondary))' }}>
            {searchQuery ? (
              <>
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-medium mb-1">No sessions found</p>
                <p className="text-sm">Try a different search term</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">💬</div>
                <p className="font-medium mb-1">No chat sessions yet</p>
                <p className="text-sm mb-4">Start a conversation with an agent</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Today */}
            {groupedSessions.today.length > 0 && (
              <SessionGroup
                title="Today"
                sessions={groupedSessions.today}
                currentSessionId={currentSessionId}
                isExpanded={expandedGroups.has('today')}
                onToggle={() => toggleGroup('today')}
                onSessionClick={handleSessionClick}
                getStatus={getStatus}
              />
            )}

            {/* Yesterday */}
            {groupedSessions.yesterday.length > 0 && (
              <SessionGroup
                title="Yesterday"
                sessions={groupedSessions.yesterday}
                currentSessionId={currentSessionId}
                isExpanded={expandedGroups.has('yesterday')}
                onToggle={() => toggleGroup('yesterday')}
                onSessionClick={handleSessionClick}
                getStatus={getStatus}
              />
            )}

            {/* This Week */}
            {groupedSessions.thisWeek.length > 0 && (
              <SessionGroup
                title="This Week"
                sessions={groupedSessions.thisWeek}
                currentSessionId={currentSessionId}
                isExpanded={expandedGroups.has('thisWeek')}
                onToggle={() => toggleGroup('thisWeek')}
                onSessionClick={handleSessionClick}
                getStatus={getStatus}
              />
            )}

            {/* Older */}
            {groupedSessions.older.length > 0 && (
              <SessionGroup
                title="Older"
                sessions={groupedSessions.older}
                currentSessionId={currentSessionId}
                isExpanded={expandedGroups.has('older')}
                onToggle={() => toggleGroup('older')}
                onSessionClick={handleSessionClick}
                getStatus={getStatus}
              />
            )}
          </div>
        )}
      </div>

      {/* New Session Button */}
      <div className="p-4 border-t" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <button
          onClick={onNewSession}
          className="w-full px-4 py-3 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: 'rgb(var(--primary-color, 59 130 246))',
            color: 'white',
          }}
        >
          ➕ New Session
        </button>
      </div>
    </div>
  )
}

interface SessionGroupProps {
  title: string
  sessions: ChatSession[]
  currentSessionId?: string
  isExpanded: boolean
  onToggle: () => void
  onSessionClick: (sessionId: string) => void
  getStatus: (sessionId: string) => SessionStatus | undefined
}

function SessionGroup({ title, sessions, currentSessionId, isExpanded, onToggle, onSessionClick, getStatus }: SessionGroupProps) {
  return (
    <div>
      {/* Group Header */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between rounded-lg hover:bg-opacity-50 transition-colors mb-2"
        style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
      >
        <span className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{
            backgroundColor: 'rgb(var(--bg-primary))',
            color: 'rgb(var(--text-secondary))'
          }}>
            {sessions.length}
          </span>
          <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Sessions */}
      {isExpanded && (
        <div className="space-y-2 ml-2">
          {sessions.map((session) => (
            <EnhancedSessionCard
              key={session.id}
              session={session}
              realTimeStatus={getStatus(session.id)}
              isActive={session.id === currentSessionId}
              onClick={() => onSessionClick(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface EnhancedSessionCardProps {
  session: ChatSession
  realTimeStatus?: SessionStatus
  isActive: boolean
  onClick: () => void
}

function EnhancedSessionCard({ session, realTimeStatus, isActive, onClick }: EnhancedSessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    return `${diffHours}h ago`
  }

  // Get the display status (real-time status or fall back to session status)
  // Map database session status to SessionStatusType
  const displayStatus: SessionStatusType = realTimeStatus?.status ||
    (session.status === 'inactive' ? 'stopped' : 'idle')
  const lastActivity = realTimeStatus?.lastActivity || new Date(session.updated_at).getTime()
  const isAnimated = ['thinking', 'calling_mcp', 'writing'].includes(displayStatus)

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${
        isActive ? 'ring-2 ring-blue-500' : ''
      } ${isAnimated ? 'animate-pulse' : ''}`}
      style={{
        borderColor: isActive ? 'rgb(59 130 246)' : 'rgb(var(--border-color))',
        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgb(var(--bg-secondary))'
      }}
    >
      {/* Main Card */}
      <div className="p-3" onClick={onClick}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🤖</span>
              <h3 className="font-medium text-sm truncate" style={{ color: 'rgb(var(--text-primary))' }}>
                {session.title || 'New Chat'}
              </h3>
            </div>
            <p className="text-xs truncate" style={{ color: 'rgb(var(--text-secondary))' }}>
              {session.agent_name}
            </p>
            {/* Description */}
            {session.description && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                {session.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              {formatRelativeTime(new Date(lastActivity).toISOString())}
            </span>
            {/* Real-time status indicator */}
            <SessionStatusIndicator
              status={displayStatus}
              toolName={realTimeStatus?.toolName}
              compact
            />
          </div>
        </div>
      </div>

      {/* Expand Button */}
      <button
        className="w-full px-3 py-1.5 text-xs flex items-center justify-center gap-1 border-t hover:bg-opacity-50 transition-colors"
        style={{ borderColor: 'rgb(var(--border-color))' }}
        onClick={(e) => {
          e.stopPropagation()
          setIsExpanded(!isExpanded)
        }}
      >
        <span>{isExpanded ? '▲' : '▼'}</span>
        <span>{isExpanded ? 'Less' : 'More'}</span>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 py-2 border-t text-xs space-y-1" style={{ borderColor: 'rgb(var(--border-color))' }}>
          <div className="flex justify-between">
            <span style={{ color: 'rgb(var(--text-secondary))' }}>Session ID:</span>
            <span className="font-mono" style={{ color: 'rgb(var(--text-primary))' }}>
              {session.id.slice(0, 8)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'rgb(var(--text-secondary))' }}>Agent:</span>
            <span style={{ color: 'rgb(var(--text-primary))' }}>{session.agent_name}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'rgb(var(--text-secondary))' }}>Status:</span>
            <span style={{ color: 'rgb(var(--text-primary))' }}>
              <SessionStatusIndicator
                status={displayStatus}
                toolName={realTimeStatus?.toolName}
                compact
                showLabel
              />
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'rgb(var(--text-secondary))' }}>Created:</span>
            <span style={{ color: 'rgb(var(--text-primary))' }}>
              {new Date(session.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'rgb(var(--text-secondary))' }}>Last Activity:</span>
            <span style={{ color: 'rgb(var(--text-primary))' }}>
              {formatRelativeTime(new Date(lastActivity).toISOString())}
            </span>
          </div>
          <button
            className="w-full mt-2 px-2 py-1.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            Continue Chat →
          </button>
        </div>
      )}
    </div>
  )
}
