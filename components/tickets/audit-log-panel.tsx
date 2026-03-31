'use client'

import React, { useMemo, useState } from 'react'
interface AuditLogPanelProps {
  logs: Array<{
    id: string
    event_type: string
    actor: {
      id: string
      type: string
      email: string | null
    }
    old_value: string | null
    new_value: string | null
    metadata: string | null
    created_at: string
  }>
}

function getEventIcon(eventType: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    created: (
      <span className="text-green-500">📝</span>
    ),
    updated: (
      <span className="text-blue-500">✏️</span>
    ),
    status_changed: (
      <span className="text-purple-500">🔄</span>
    ),
    comment_added: (
      <span className="text-yellow-500">💬</span>
    ),
    comment_updated: (
      <span className="text-yellow-500">💬</span>
    ),
    comment_deleted: (
      <span className="text-red-500">🗑️</span>
    ),
    flow_transition: (
      <span className="text-cyan-500">➡️</span>
    ),
    agent_assigned: (
      <span className="text-indigo-500">🤖</span>
    ),
    flow_started: (
      <span className="text-emerald-500">▶️</span>
    ),
    flow_completed: (
      <span className="text-green-500">✅</span>
    ),
    flow_failed: (
      <span className="text-red-500">⚠️</span>
    ),
    flow_restarted: (
      <span className="text-orange-500">🔁</span>
    ),
    flow_stopped: (
      <span className="text-gray-500">⏹️</span>
    ),
  }
  return icons[eventType] || '•'
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    created: 'created this ticket',
    updated: 'edited this ticket',
    status_changed: 'changed status',
    comment_added: 'added a comment',
    comment_updated: 'updated a comment',
    comment_deleted: 'deleted a comment',
    flow_transition: 'flow transition',
    agent_assigned: 'agent assigned',
    flow_started: 'started flow',
    flow_completed: 'completed flow',
    flow_failed: 'flow failed',
    flow_restarted: 'restarted flow',
    flow_stopped: 'stopped flow',
  }
  return labels[eventType] || eventType
}

function formatEventDescription(log: AuditLogPanelProps['logs'][0]): string {
  const actorName = log.actor.type === 'user' ? log.actor.email || 'Unknown' : log.actor.type

  const safeParse = (value: string | null) => {
    if (!value) return null
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  
  switch (log.event_type) {
    case 'created':
      return `${actorName} created this ticket`
    
    case 'updated':
      return `${actorName} edited this ticket`
    
    case 'status_changed': {
      const oldVal = safeParse(log.old_value)
      const newVal = safeParse(log.new_value)
      return `${actorName} changed status from "${oldVal?.status_id || 'None'}" to "${newVal?.status_id || 'None'}"`
    }
    
    case 'comment_added': {
      const newVal = safeParse(log.new_value)
      const content = newVal?.content || ''
      const preview = content.length > 50 ? content.substring(0, 50) + '...' : content
      return `${actorName} added a comment: "${preview}"`
    }
    
    case 'flow_transition': {
      const oldVal = safeParse(log.old_value)
      const newVal = safeParse(log.new_value)
      const result = oldVal?.result || newVal?.result
      return `Flow transition: ${result || 'completed'}`
    }
    
    case 'agent_assigned': {
      const newVal = safeParse(log.new_value)
      return `${actorName} assigned agent: ${newVal?.agent_id || 'None'}`
    }
    
    default:
      return `${actorName} ${getEventLabel(log.event_type)}`
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return date.toLocaleDateString()
}

export function AuditLogPanel({ logs }: AuditLogPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const visibleLogs = useMemo(() => {
    if (isExpanded) return logs
    return logs.slice(0, 2)
  }, [isExpanded, logs])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-primary">Activity Timeline</h3>
        {logs.length > 2 && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-xs px-2 py-1 rounded-md border transition-colors"
            style={{
              borderColor: `rgb(var(--border-color))`,
              color: `rgb(var(--text-secondary))`,
              backgroundColor: `rgb(var(--bg-secondary))`,
            }}
          >
            {isExpanded ? 'Hide older activity' : `Show all (${logs.length})`}
          </button>
        )}
      </div>
      
      {logs.length === 0 ? (
        <div className="text-center py-8 text-tertiary border-2 border-dashed border-border rounded-lg">
          <p>No activity yet</p>
        </div>
      ) : (
        <div className="space-y-0">
          {visibleLogs.map((log, index) => (
            <div key={log.id} className="flex gap-3 pb-4 relative">
              {/* Timeline Line */}
              {index !== visibleLogs.length - 1 && (
                <div className="absolute left-[11px] top-6 w-px h-full bg-border" />
              )}
              
              {/* Icon */}
              <div className="relative z-10 w-6 h-6 flex-shrink-0 flex items-center justify-center">
                {getEventIcon(log.event_type)}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-primary break-words">
                  {formatEventDescription(log)}
                </p>
                <p className="text-xs text-secondary mt-0.5">
                  {formatTimestamp(log.created_at)}
                </p>
                
                {/* Additional Details */}
                {(log.event_type === 'updated' || log.event_type === 'status_changed') && (
                  <details className="mt-2 group">
                    <summary className="text-xs text-tertiary cursor-pointer hover:text-secondary">
                      View details
                    </summary>
                    <div className="mt-2 p-2 bg-tertiary rounded text-xs font-mono text-secondary max-h-32 overflow-auto">
                      {log.old_value && (
                        <div className="mb-1">
                          <span className="text-red-400">- </span>
                          <span className="opacity-75">{log.old_value}</span>
                        </div>
                      )}
                      {log.new_value && (
                        <div>
                          <span className="text-green-400">+ </span>
                          <span className="opacity-75">{log.new_value}</span>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
