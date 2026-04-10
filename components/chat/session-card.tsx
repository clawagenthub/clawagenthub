'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionStatusBadge } from './session-status-badge'
import { useUpdateSessionTitle } from '@/lib/query/hooks/useChat'
import type { ChatSession, MCPActivity } from '@/lib/db/schema'

interface SessionCardProps {
  session: ChatSession & { lastMessagePreview?: string }
  isActive?: boolean
}

export function SessionCard({ session, isActive = false }: SessionCardProps) {
  const _router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(session.title || 'New Chat')
  const updateTitle = useUpdateSessionTitle()

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingTitle(true)
    setEditedTitle(session.title || 'New Chat')
  }

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle !== session.title) {
      await updateTitle.mutateAsync({ sessionId: session.id, title: editedTitle.trim() })
    }
    setIsEditingTitle(false)
  }

  const handleTitleCancel = () => {
    setIsEditingTitle(false)
    setEditedTitle(session.title || 'New Chat')
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      handleTitleCancel()
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const mcpActivity: MCPActivity | null = session.mcp_activity 
    ? JSON.parse(session.mcp_activity) 
    : null

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
      }`}
      style={{
        borderColor: isActive ? undefined : 'rgb(var(--border-color))',
        backgroundColor: isActive ? undefined : 'rgb(var(--bg-secondary))',
      }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleTitleSave}
                className="w-full px-2 py-1 text-sm rounded border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'rgb(var(--bg-primary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))',
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div 
                className="flex items-center gap-2 group cursor-pointer"
                onClick={handleTitleClick}
              >
                <h3
                  className="font-medium truncate group-hover:text-blue-500 transition-colors"
                  style={{ color: `rgb(var(--text-primary))` }}
                >
                  {session.title || 'New Chat'}
                </h3>
                <span className="opacity-0 group-hover:opacity-100 text-xs text-gray-400">
                  ✏️
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SessionStatusBadge status={session.status} size="sm" />
            <span className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>
              {session.status === 'active' ? 'Live' : session.status === 'idle' ? 'Idle' : 'Archived'}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div
          className="flex items-center gap-2 text-xs mb-2"
          style={{ color: `rgb(var(--text-secondary))` }}
        >
          <span>🤖 {session.agent_name}</span>
          <span>•</span>
          <span>{formatRelativeTime(session.updated_at)}</span>
        </div>

        {/* Description */}
        {session.description && (
          <p
            className="text-xs mb-2 line-clamp-2"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            {session.description}
          </p>
        )}

        {/* MCP Activity */}
        {mcpActivity && (
          <div className="mb-2">
            <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
              🔧 {mcpActivity.tool}
            </span>
          </div>
        )}

        {/* Preview */}
        {session.lastMessagePreview && (
          <p
            className="text-sm line-clamp-2"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            {session.lastMessagePreview}
          </p>
        )}

        {/* Expand/Collapse Button */}
        <button
          className="mt-2 text-xs"
          style={{ color: `rgb(var(--text-secondary))` }}
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
        >
          {isExpanded ? '▲ Collapse' : '▼ Expand'}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div
            className="mt-3 pt-3 border-t text-sm"
            style={{ borderColor: `rgb(var(--border-color))`, color: `rgb(var(--text-secondary))` }}
          >
            <div className="space-y-1">
              <div>
                <span className="font-medium">Session ID:</span> {session.id.slice(0, 8)}...
              </div>
              <div>
                <span className="font-medium">Agent ID:</span> {session.agent_id}
              </div>
              <div>
                <span className="font-medium">Created:</span> {new Date(session.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
