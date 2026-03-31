/**
 * Session Status Indicator Component
 * 
 * Visual component showing current session status with icons and animations.
 * Status types: idle, thinking, calling_mcp, writing, stopped, failed
 */

'use client'

import React from 'react'
import type { SessionStatusType } from '@/lib/session/status-tracker'

export interface SessionStatusIndicatorProps {
  status: SessionStatusType
  toolName?: string
  compact?: boolean
  showLabel?: boolean
  className?: string
}

const STATUS_CONFIG: Record<
  SessionStatusType,
  {
    icon: string
    label: string
    color: string
    bgColor: string
    textColor: string
    animated: boolean
  }
> = {
  idle: {
    icon: '💤',
    label: 'Idle',
    color: 'gray',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-600 dark:text-gray-400',
    animated: false,
  },
  thinking: {
    icon: '🧠',
    label: 'Thinking',
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    animated: true,
  },
  calling_mcp: {
    icon: '🔧',
    label: 'Calling',
    color: 'purple',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-600 dark:text-purple-400',
    animated: true,
  },
  writing: {
    icon: '✍️',
    label: 'Writing',
    color: 'green',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400',
    animated: true,
  },
  stopped: {
    icon: '⏸️',
    label: 'Stopped',
    color: 'gray',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-500 dark:text-gray-500',
    animated: false,
  },
  failed: {
    icon: '❌',
    label: 'Failed',
    color: 'red',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-600 dark:text-red-400',
    animated: false,
  },
}

/**
 * Session status indicator with icon and optional label
 * 
 * @example
 * ```tsx
 * <SessionStatusIndicator status="thinking" compact />
 * <SessionStatusIndicator status="calling_mcp" toolName="web_search" />
 * ```
 */
export function SessionStatusIndicator({
  status,
  toolName,
  compact = false,
  showLabel = true,
  className = '',
}: SessionStatusIndicatorProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle
  const isAnimated = config.animated
  const displayLabel = toolName && status === 'calling_mcp' ? `${toolName}` : config.label

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 ${isAnimated ? 'animate-pulse' : ''} ${className}`}
        title={config.label}
      >
        <span className="text-sm" role="img" aria-label={config.label}>
          {config.icon}
        </span>
        {showLabel && (
          <span className={`text-xs font-medium ${config.textColor}`}>
            {displayLabel}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${config.bgColor} ${
        isAnimated ? 'animate-pulse' : ''
      } ${className}`}
    >
      <span className="text-sm" role="img" aria-label={config.label}>
        {config.icon}
      </span>
      {showLabel && (
        <span className={`text-xs font-medium ${config.textColor}`}>
          {displayLabel}
        </span>
      )}
    </div>
  )
}

/**
 * Minimal dot indicator for session status
 */
export interface SessionStatusDotProps {
  status: SessionStatusType
  className?: string
}

export function SessionStatusDot({ status, className = '' }: SessionStatusDotProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle
  const isAnimated = config.animated

  const colorClasses: Record<SessionStatusType, string> = {
    idle: 'bg-gray-400',
    thinking: 'bg-blue-500',
    calling_mcp: 'bg-purple-500',
    writing: 'bg-green-500',
    stopped: 'bg-gray-300',
    failed: 'bg-red-500',
  }

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      title={config.label}
    >
      {/* Outer glow for animated states */}
      {isAnimated && (
        <div
          className={`absolute inset-0 rounded-full ${colorClasses[status]} opacity-30 animate-ping`}
        />
      )}
      {/* Main dot */}
      <div
        className={`w-2.5 h-2.5 rounded-full ${colorClasses[status]} ${
          isAnimated ? 'animate-pulse' : ''
        }`}
      />
    </div>
  )
}

/**
 * Session status badge with more detailed information
 */
export interface SessionStatusBadgeProps {
  status: SessionStatusType
  toolName?: string
  lastActivity?: number
  className?: string
}

export function SessionStatusBadge({
  status,
  toolName,
  lastActivity,
  className = '',
}: SessionStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle
  const isAnimated = config.animated

  const formatLastActivity = (timestamp?: number) => {
    if (!timestamp) return ''
    const diff = Date.now() - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (seconds < 60) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    return `${hours}h ago`
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor} ${
        isAnimated ? 'animate-pulse' : ''
      } ${className}`}
    >
      <span className="text-sm" role="img" aria-label={config.label}>
        {config.icon}
      </span>
      <div className="flex flex-col">
        <span className={`text-xs font-semibold ${config.textColor}`}>
          {config.label}
          {toolName && status === 'calling_mcp' && `: ${toolName}`}
        </span>
        {lastActivity && (
          <span className="text-xs opacity-60" style={{ color: 'rgb(var(--text-secondary))' }}>
            {formatLastActivity(lastActivity)}
          </span>
        )}
      </div>
    </div>
  )
}
