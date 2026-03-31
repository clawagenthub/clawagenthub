'use client'

import React from 'react'

interface ToolCall {
  id: string
  name: string
  status: 'running' | 'success' | 'error'
  result?: string
  startedAt: number
}

interface ToolCallCardProps {
  tool: ToolCall
}

const getToolIcon = (name: string): string => {
  const lower = name.toLowerCase()
  if (lower.includes('search') || lower.includes('web')) return '🔍'
  if (lower.includes('github')) return '🐙'
  if (lower.includes('file') || lower.includes('read')) return '📄'
  if (lower.includes('write') || lower.includes('save')) return '💾'
  if (lower.includes('shell') || lower.includes('exec') || lower.includes('run')) return '⚡'
  if (lower.includes('database') || lower.includes('db')) return '🗄️'
  if (lower.includes('http') || lower.includes('api') || lower.includes('fetch')) return '🌐'
  if (lower.includes('think') || lower.includes('reason')) return '🧠'
  return '🔧'
}

const getStatusColor = (status: ToolCall['status']) => {
  switch (status) {
    case 'running': return 'text-blue-600 dark:text-blue-400'
    case 'success': return 'text-green-600 dark:text-green-400'
    case 'error': return 'text-red-600 dark:text-red-400'
  }
}

const getStatusIcon = (status: ToolCall['status']) => {
  switch (status) {
    case 'running': return '⟳'
    case 'success': return '✓'
    case 'error': return '✕'
  }
}

export function ToolCallCard({ tool }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const duration = Math.round((Date.now() - tool.startedAt) / 1000)

  return (
    <div className="px-6 py-2">
      <div
        className="max-w-2xl rounded-lg overflow-hidden transition-all"
        style={{
          backgroundColor: 'rgb(var(--bg-secondary))',
          border: `1px solid ${tool.status === 'error' ? 'rgb(239 68 68)' : 'rgb(var(--border-color))'}`
        }}
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-opacity-50 transition-colors"
          style={{ backgroundColor: tool.status === 'running' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
        >
          <div className="flex items-center gap-3">
            {/* Tool Icon */}
            <span className="text-xl">{getToolIcon(tool.name)}</span>
            
            {/* Tool Info */}
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  {tool.name}
                </span>
                <span className={`text-sm ${getStatusColor(tool.status)}`}>
                  {getStatusIcon(tool.status)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                  backgroundColor: tool.status === 'running' ? 'rgb(59 130 246, 0.2)' : 
                                   tool.status === 'success' ? 'rgb(34 197 94, 0.2)' : 'rgb(239 68 68, 0.2)',
                  color: tool.status === 'running' ? 'rgb(59 130 246)' : 
                         tool.status === 'success' ? 'rgb(34 197 94)' : 'rgb(239 68 68)'
                }}>
                  {tool.status === 'running' ? 'Running...' : tool.status}
                </span>
              </div>
              {tool.status === 'running' && (
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Executing...
                </p>
              )}
            </div>
          </div>

          {/* Expand/Collapse & Duration */}
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              {duration}s
            </span>
            <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: 'rgb(var(--border-color))' }}>
            <div className="space-y-2">
              {/* Tool Name */}
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Tool:
                </span>
                <span className="text-sm font-mono" style={{ color: 'rgb(var(--text-primary))' }}>
                  {tool.name}
                </span>
              </div>

              {/* Started At */}
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Started:
                </span>
                <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                  {new Date(tool.startedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* Result (if available) */}
              {tool.result && (
                <div className="mt-3">
                  <span className="text-sm block mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Result:
                  </span>
                  <pre className="text-xs p-3 rounded-lg overflow-x-auto bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                    {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error state */}
              {tool.status === 'error' && !tool.result && (
                <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                  An error occurred while executing this tool
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
