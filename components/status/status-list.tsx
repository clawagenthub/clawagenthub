'use client'

import React from 'react'
import { StatusCard } from './status-card'
import type { Status } from '@/lib/db/schema'

interface StatusListProps {
  statuses: Status[]
  onEdit: (status: Status) => void
  onDelete: (status: Status) => void
  canManage: boolean
}

export function StatusList({ statuses, onEdit, onDelete, canManage }: StatusListProps) {
  if (statuses.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border py-12"
        style={{
          backgroundColor: `rgb(var(--bg-primary))`,
          borderColor: `rgb(var(--border-color))`,
        }}
      >
        <div className="mb-4 text-4xl">🏷️</div>
        <h3
          className="mb-2 text-lg font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          No statuses yet
        </h3>
        <p style={{ color: `rgb(var(--text-secondary))` }}>
          {canManage
            ? 'Create your first status to get started.'
            : 'Your workspace hasn\'t created any statuses yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {statuses.map((status) => (
        <StatusCard
          key={status.id}
          status={status}
          onEdit={onEdit}
          onDelete={onDelete}
          canManage={canManage}
        />
      ))}
    </div>
  )
}
