'use client'

import React, { useEffect, useState } from 'react'

type ActivityState = {
  state: 'idle' | 'thinking' | 'searching' | 'calling_mcp' | 'writing' | 'error'
  message?: string
  toolName?: string
  startedAt?: number
}

interface ActivityStatusBarProps {
  activity: ActivityState
}

const getStateConfig = (state: ActivityState['state'], message?: string, toolName?: string) => {
  switch (state) {
    case 'thinking':
      return {
        icon: '🧠',
        color: 'bg-purple-500',
        message: message || 'Thinking...',
        animation: 'pulse'
      }
    case 'searching':
      return {
        icon: '🔍',
        color: 'bg-blue-500',
        message: message || 'Searching...',
        animation: 'bounce'
      }
    case 'calling_mcp':
      return {
        icon: toolName?.toLowerCase().includes('github') ? '🐙' : 
              toolName?.toLowerCase().includes('search') ? '🔍' : 
              toolName?.toLowerCase().includes('file') ? '📄' : '🔧',
        color: 'bg-orange-500',
        message: message || `Using ${toolName || 'tool'}...`,
        animation: 'spin'
      }
    case 'writing':
      return {
        icon: '✍️',
        color: 'bg-green-500',
        message: message || 'Generating response...',
        animation: 'pulse'
      }
    case 'error':
      return {
        icon: '⚠️',
        color: 'bg-red-500',
        message: message || 'An error occurred',
        animation: 'none'
      }
    default:
      return null
  }
}

export function ActivityStatusBar({ activity }: ActivityStatusBarProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (activity.state === 'idle' || !activity.startedAt) {
      setElapsed(0)
      return
    }

    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - activity.startedAt!) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [activity.state, activity.startedAt])

  const config = getStateConfig(activity.state, activity.message, activity.toolName)

  if (!config || activity.state === 'idle') {
    return null
  }

  const getAnimationClass = (animation: string) => {
    switch (animation) {
      case 'pulse': return 'animate-pulse'
      case 'bounce': return 'animate-bounce'
      case 'spin': return 'animate-spin'
      default: return ''
    }
  }

  return (
    <div
      className="px-6 py-2 flex items-center gap-3 border-b transition-all"
      style={{ borderColor: 'rgb(var(--border-color))' }}
    >
      {/* Animated Icon */}
      <div className={`w-6 h-6 rounded-full ${config.color} ${getAnimationClass(config.animation)} flex items-center justify-center text-white text-xs`}>
        {config.icon}
      </div>

      {/* Message */}
      <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
        {config.message}
      </span>

      {/* Elapsed Time */}
      {elapsed > 0 && activity.state !== 'error' && (
        <span className="text-xs ml-auto" style={{ color: 'rgb(var(--text-secondary))' }}>
          {elapsed}s
        </span>
      )}

      {/* Progress Dots for running state */}
      {activity.state === 'calling_mcp' && (
        <div className="flex gap-1 ml-2">
          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      )}
    </div>
  )
}
