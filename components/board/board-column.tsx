'use client'

import React from 'react'
import type { TicketWithRelations } from '@/lib/query/hooks'

const FLOW_BADGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  flowing: {
    label: 'Flowing',
    bg: 'rgba(16, 185, 129, 0.18)',
    text: 'rgb(5, 150, 105)',
  },
  failed: {
    label: 'Failed',
    bg: 'rgba(239, 68, 68, 0.18)',
    text: 'rgb(220, 38, 38)',
  },
  waiting: {
    label: 'Waiting',
    bg: 'rgba(245, 158, 11, 0.18)',
    text: 'rgb(217, 119, 6)',
  },
  stopped: {
    label: 'Stopped',
    bg: 'rgba(107, 114, 128, 0.18)',
    text: 'rgb(75, 85, 99)',
  },
  completed: {
    label: 'Completed',
    bg: 'rgba(59, 130, 246, 0.18)',
    text: 'rgb(37, 99, 235)',
  },
}

interface BoardColumnProps {
  id: string
  title: string
  color: string
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, columnId: string) => void
  onDragStart: (e: React.DragEvent, columnId: string) => void
  draggable?: boolean
  tickets?: TicketWithRelations[]
  showDrafts?: boolean
  onTicketDoubleClick?: (ticket: TicketWithRelations) => void
  onTicketDelete?: (ticket: TicketWithRelations) => void
  deletingTicketId?: string | null
}

export function BoardColumn({
  id,
  title,
  color,
  onDragOver,
  onDrop,
  onDragStart,
  draggable = true,
  tickets = [],
  showDrafts = false,
  onTicketDoubleClick,
  onTicketDelete,
  deletingTicketId = null,
}: BoardColumnProps) {
  // Filter tickets based on showDrafts setting
  const visibleTickets = tickets.filter(ticket => {
    // Always show active tickets
    if (ticket.creation_status === 'active') return true
    // Only show draft tickets when showDrafts is true
    return showDrafts && ticket.creation_status === 'draft'
  })

  const draftCount = tickets.filter(t => t.creation_status === 'draft').length

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart(e, id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, id)}
      className="w-full h-full rounded-lg p-4 border-2 transition-all cursor-move"
      style={{
        backgroundColor: `rgb(var(--bg-secondary))`,
        borderColor: `rgb(var(--border-color))`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h3
            className="font-semibold"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            {title}
          </h3>
          {draftCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(156, 163, 175, 0.2)',
                color: 'rgb(var(--text-tertiary))',
              }}
            >
              {draftCount} draft{draftCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          type="button"
          className="transition-colors"
          style={{ color: `rgb(var(--text-tertiary))` }}
        >
          ⋮
        </button>
      </div>
      <div className="space-y-2 min-h-[200px]">
        {visibleTickets.length === 0 ? (
          <p
            className="text-sm text-center py-8"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            {showDrafts && draftCount > 0 
              ? `No active tickets. ${draftCount} draft ticket${draftCount !== 1 ? 's' : ''} hidden.`
              : 'No tickets'}
          </p>
        ) : (
          visibleTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md"
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onTicketDoubleClick?.(ticket)
              }}
              style={{
                backgroundColor: `rgb(var(--bg-primary))`,
                borderColor: ticket.creation_status === 'draft'
                  ? 'rgba(156, 163, 175, 0.5)'
                  : `rgb(var(--border-color))`,
                borderStyle: ticket.creation_status === 'draft' ? 'dashed' : 'solid',
                opacity: ticket.creation_status === 'draft' ? 0.8 : 1,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-medium"
                      style={{ color: `rgb(var(--text-tertiary))` }}
                    >
                      #{ticket.ticket_number}
                    </span>
                    {ticket.creation_status === 'draft' && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgba(156, 163, 175, 0.3)',
                          color: 'rgb(var(--text-tertiary))',
                        }}
                      >
                        DRAFT
                      </span>
                    )}
                    {ticket.flow_enabled && ticket.creation_status === 'active' && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: FLOW_BADGE_CONFIG[ticket.flowing_status || 'stopped']?.bg || 'rgba(107, 114, 128, 0.18)',
                          color: FLOW_BADGE_CONFIG[ticket.flowing_status || 'stopped']?.text || 'rgb(75, 85, 99)',
                        }}
                      >
                        {FLOW_BADGE_CONFIG[ticket.flowing_status || 'stopped']?.label || 'Stopped'}
                      </span>
                    )}
                  </div>
                  <h4
                    className="text-sm font-medium mt-1 truncate"
                    style={{ color: `rgb(var(--text-primary))` }}
                  >
                    {ticket.title}
                  </h4>
                  {ticket.description && (
                    <p
                      className="text-xs mt-1 line-clamp-2"
                      style={{ color: `rgb(var(--text-secondary))` }}
                    >
                      {ticket.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {ticket.assigned_to_user && (
                      <span
                        className="text-xs truncate"
                        style={{ color: `rgb(var(--text-tertiary))` }}
                      >
                        {ticket.assigned_to_user.email}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onTicketDelete?.(ticket)
                  }}
                  disabled={deletingTicketId === ticket.id}
                  className="text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    color: 'rgb(220, 38, 38)',
                    backgroundColor: 'rgba(220, 38, 38, 0.08)'
                  }}
                  title={deletingTicketId === ticket.id ? 'Deleting...' : 'Delete ticket'}
                >
                  {deletingTicketId === ticket.id ? 'Deleting...' : '🗑 Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
