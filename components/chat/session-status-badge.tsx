'use client'

import React from 'react'
import type { SessionStatus } from '@/lib/db/schema'

interface SessionStatusBadgeProps {
  status: SessionStatus
  size?: 'sm' | 'md'
}

export function SessionStatusBadge({ status, size = 'md' }: SessionStatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
  
  const statusConfig = {
    active: {
      color: 'bg-green-500',
      label: 'Active',
      icon: '🟢',
    },
    idle: {
      color: 'bg-yellow-500',
      label: 'Idle',
      icon: '🟡',
    },
    inactive: {
      color: 'bg-gray-400',
      label: 'Inactive',
      icon: '⚪',
    },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-1.5">
      <div className={`${sizeClasses} ${config.color} rounded-full`}></div>
      {size === 'md' && (
        <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
          {config.label}
        </span>
      )}
    </div>
  )
}
