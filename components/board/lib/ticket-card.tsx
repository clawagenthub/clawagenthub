'use client'

import React from 'react'
import type { TicketWithRelations } from '@/lib/query/hooks'
import { FLOW_BADGE_CONFIG } from './board-types'

interface TicketCardProps {
  ticket: TicketWithRelations
  _isSelected: boolean
  isDragging: boolean
  selectedTicketIds: string[]
  onSelect?: (ticketId: string, selected: boolean) => void
  onDoubleClick?: (ticket: TicketWithRelations) => void
  onDragStart?: (ticketId: string) => void
}

export function TicketCard({
  ticket,
  _isSelected,
  isDragging,
  selectedTicketIds,
  onSelect,
  onDoubleClick,
  onDragStart,
}: TicketCardProps) {
  return (
    <div
      key={ticket.id}
      draggable={true}
      onDragStart={(e) => {
        e.stopPropagation()
        onDragStart?.(ticket.id)
      }}
      className="p-3 rounded-lg border cursor-move transition-all hover:shadow-md"
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDoubleClick?.(ticket)
      }}
      style={{
        backgroundColor: `rgb(var(--bg-primary))`,
        borderColor: selectedTicketIds.includes(ticket.id)
          ? 'rgb(59, 130, 246)'
          : ticket.creation_status === 'draft'
            ? 'rgba(156, 163, 175, 0.5)'
            : `rgb(var(--border-color))`,
        borderStyle: ticket.creation_status === 'draft' ? 'dashed' : 'solid',
        opacity: isDragging ? 0.5 : (ticket.creation_status === 'draft' ? 0.8 : 1),
        borderWidth: selectedTicketIds.includes(ticket.id) ? '2px' : '1px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {ticket.creation_status === 'active' && (
          <input
            type="checkbox"
            checked={selectedTicketIds.includes(ticket.id)}
            onChange={(e) => {
              e.stopPropagation()
              onSelect?.(ticket.id, e.target.checked)
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded cursor-pointer flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
      </div>
    </div>
  )
}
