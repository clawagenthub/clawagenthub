'use client'

import React from 'react'
import type { Status } from '@/lib/db/schema'

interface StatusCardProps {
  status: Status
  onEdit: (status: Status) => void
  onDelete: (status: Status) => void
  canManage: boolean
  draggable?: boolean
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  isDragging?: boolean
}

export function StatusCard({
  status,
  onEdit,
  onDelete,
  canManage,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false
}: StatusCardProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="group relative rounded-lg border p-4 transition-all hover:shadow-md"
      style={{
        backgroundColor: `rgb(var(--bg-primary))`,
        borderColor: `rgb(var(--border-color))`,
        opacity: isDragging ? 0.5 : 1,
        cursor: draggable ? 'move' : 'default',
      }}
    >
      {/* Color indicator and name */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-4 w-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: status.color }}
          />
          <h3
            className="font-medium truncate"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            {status.name}
          </h3>
        </div>
        {/* Priority badge */}
        <div
          className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{
            backgroundColor: `rgb(var(--bg-tertiary))`,
            color: `rgb(var(--text-secondary))`,
          }}
        >
          {status.priority}
        </div>
      </div>

      {/* Flow Configuration Badges */}
      {(status.is_flow_included || status.on_failed_goto || status.ask_approve_to_continue) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {status.is_flow_included && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(156, 163, 175, 0.2)',
                color: 'rgb(var(--text-secondary))',
              }}
            >
              In Flow
            </span>
          )}
          {status.on_failed_goto && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                color: 'rgb(249, 115, 22)',
              }}
            >
              On Fail →
            </span>
          )}
          {status.ask_approve_to_continue && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                color: 'rgb(234, 179, 8)',
              }}
            >
              Approval
            </span>
          )}
        </div>
      )}

      {/* Agent ID badge - if assigned to an agent */}
      {status.agent_id && (
        <div className="mb-2 flex items-center gap-2">
          <div
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              color: 'rgb(99, 102, 241)',
            }}
          >
            🤖 Agent: {status.agent_id}
          </div>
        </div>
      )}

      {/* Description */}
      {status.description && (
        <p
          className="mb-3 text-sm line-clamp-2"
          style={{ color: `rgb(var(--text-secondary))` }}
        >
          {status.description}
        </p>
      )}

      {/* Actions - visible on hover or always on mobile */}
      {canManage && (
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(status)}
            className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: `rgb(var(--bg-secondary))`,
              color: `rgb(var(--text-primary))`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `rgb(var(--bg-tertiary))`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(status)}
            className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors"
            style={{
              backgroundColor: `rgb(var(--bg-secondary))`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
