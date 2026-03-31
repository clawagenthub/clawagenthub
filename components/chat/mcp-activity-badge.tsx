'use client'

import React from 'react'
import type { MCPActivity } from '@/lib/db/schema'

interface MCPActivityBadgeProps {
  activity: MCPActivity
}

export function MCPActivityBadge({ activity }: MCPActivityBadgeProps) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
    >
      <span>🔧</span>
      <span>{activity.tool}</span>
      {activity.action && (
        <span className="opacity-70">· {activity.action}</span>
      )}
    </div>
  )
}
