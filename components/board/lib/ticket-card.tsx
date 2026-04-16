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
      className="cursor-move rounded-lg border p-3 transition-all hover:shadow-md"
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
        opacity: isDragging
          ? 0.5
          : ticket.creation_status === 'draft'
            ? 0.8
            : 1,
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
            className="mt-1 h-4 w-4 flex-shrink-0 cursor-pointer rounded"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: `rgb(var(--text-tertiary))` }}
            >
              #{ticket.ticket_number}
            </span>
            {ticket.creation_status === 'draft' && (
              <span
                className="rounded px-1.5 py-0.5 text-xs"
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
                className="rounded px-1.5 py-0.5 text-xs"
                style={{
                  backgroundColor:
                    FLOW_BADGE_CONFIG[ticket.flowing_status || 'stopped']?.bg ||
                    'rgba(107, 114, 128, 0.18)',
                  color:
                    FLOW_BADGE_CONFIG[ticket.flowing_status || 'stopped']
                      ?.text || 'rgb(75, 85, 99)',
                }}
              >
                {FLOW_BADGE_CONFIG[ticket.flowing_status || 'stopped']?.label ||
                  'Stopped'}
              </span>
            )}
            {ticket.waiting_finished_ticket_id && (
              <span
                className="rounded px-1.5 py-0.5 text-xs"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.18)',
                  color: 'rgb(217, 119, 6)',
                }}
                title={`Waiting to #${ticket.waiting_finished_ticket_number ?? ticket.waiting_finished_ticket_id}`}
              >
                Waiting to #
                {ticket.waiting_finished_ticket_number ??
                  ticket.waiting_finished_ticket_id}
              </span>
            )}
          </div>
          <h4
            className="mt-1 truncate text-sm font-medium"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            {ticket.title}
          </h4>
          {ticket.description && (
            <p
              className="mt-1 line-clamp-2 text-xs"
              style={{ color: `rgb(var(--text-secondary))` }}
            >
              {ticket.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {ticket.assigned_to_user && (
              <span
                className="truncate text-xs"
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
