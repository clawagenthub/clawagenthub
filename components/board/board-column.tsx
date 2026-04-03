'use client'

import React, { useState } from 'react'
import type { TicketWithRelations } from '@/lib/query/hooks'
import { useBulkStartTicketFlow, useBulkStopTicketFlow } from '@/lib/query/hooks'

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
  tickets?: TicketWithRelations[]
  showDrafts?: boolean
  onTicketDoubleClick?: (ticket: TicketWithRelations) => void
  onTicketDragStart?: (ticketId: string) => void
  onTicketDragOver?: (e: React.DragEvent) => void
  onTicketDrop?: (e: React.DragEvent, statusId: string) => void
  draggedTicketId?: string | null
}

export function BoardColumn({
  id,
  title,
  color,
  tickets = [],
  showDrafts = false,
  onTicketDoubleClick,
  onTicketDragStart,
  onTicketDragOver,
  onTicketDrop,
  draggedTicketId = null,
}: BoardColumnProps) {
  const { mutateAsync: bulkStartFlow, isPending: isBulkStartingFlow } = useBulkStartTicketFlow()
  const { mutateAsync: bulkStopFlow, isPending: isBulkStoppingFlow } = useBulkStopTicketFlow()
  const [showStartAllConfirm, setShowStartAllConfirm] = useState(false)
  const [showStopAllConfirm, setShowStopAllConfirm] = useState(false)

  const visibleTickets = tickets.filter(ticket => {
    if (ticket.creation_status === 'active') return true
    return showDrafts && ticket.creation_status === 'draft'
  })

  const draftCount = tickets.filter(t => t.creation_status === 'draft').length

  const eligibleForFlowStart = visibleTickets.filter(
    t => t.flow_enabled && t.creation_status === 'active' && t.flowing_status !== 'flowing'
  )

  const eligibleForFlowStop = visibleTickets.filter(
    t => t.flow_enabled && t.creation_status === 'active' && t.flowing_status === 'flowing'
  )

  // Show Stop All button only when ALL visible active tickets with flow enabled are flowing
  const allFlowingTickets = visibleTickets.filter(
    t => t.flow_enabled && t.creation_status === 'active'
  )
  const showStopAll = allFlowingTickets.length > 0 && 
    allFlowingTickets.every(t => t.flowing_status === 'flowing')

  const handleStartFlowAll = async () => {
    if (eligibleForFlowStart.length === 0) return
    try {
      const ticketIds = eligibleForFlowStart.map(t => t.id)
      await bulkStartFlow(ticketIds)
      setShowStartAllConfirm(false)
    } catch (error) {
      console.error('Failed to start flow for all tickets:', error)
      alert(error instanceof Error ? error.message : 'Failed to start flow')
    }
  }

  const handleStopFlowAll = async () => {
    if (eligibleForFlowStop.length === 0) return
    try {
      const ticketIds = eligibleForFlowStop.map(t => t.id)
      await bulkStopFlow(ticketIds)
      setShowStopAllConfirm(false)
    } catch (error) {
      console.error('Failed to stop flow for all tickets:', error)
      alert(error instanceof Error ? error.message : 'Failed to stop flow')
    }
  }

  return (
    <div
      onDragOver={onTicketDragOver}
      onDrop={(e) => onTicketDrop?.(e, id)}
      className="w-full h-full rounded-lg p-4 border-2 transition-all"
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
        <div className="flex items-center gap-2">
          {showStopAll ? (
            <button
              type="button"
              onClick={() => setShowStopAllConfirm(true)}
              disabled={isBulkStoppingFlow}
              className="px-2 py-1 text-xs rounded-md transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'rgb(239, 68, 68)',
                color: 'white',
              }}
              title="Stop Flow for all flowing tickets"
            >
              {isBulkStoppingFlow ? 'Stopping...' : `■ Stop All (${eligibleForFlowStop.length})`}
            </button>
          ) : eligibleForFlowStart.length > 0 && (
            <button
              type="button"
              onClick={() => setShowStartAllConfirm(true)}
              disabled={isBulkStartingFlow}
              className="px-2 py-1 text-xs rounded-md transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'rgb(16, 185, 129)',
                color: 'white',
              }}
              title="Start Flow for all eligible tickets"
            >
              {isBulkStartingFlow ? 'Starting...' : `▶ Start All (${eligibleForFlowStart.length})`}
            </button>
          )}
          <button
            type="button"
            className="transition-colors"
            style={{ color: `rgb(var(--text-tertiary))` }}
          >
            ⋮
          </button>
        </div>
      </div>

      {showStartAllConfirm && (
        <div
          className="mb-4 p-3 rounded-lg border"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgb(16, 185, 129)',
          }}
        >
          <p className="text-sm mb-2" style={{ color: `rgb(var(--text-primary))` }}>
            Start flow for {eligibleForFlowStart.length} eligible ticket{eligibleForFlowStart.length === 1 ? '' : 's'}?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStartFlowAll}
              className="px-3 py-1 text-xs rounded-md"
              style={{ backgroundColor: 'rgb(16, 185, 129)', color: 'white' }}
            >
              Start All
            </button>
            <button
              type="button"
              onClick={() => setShowStartAllConfirm(false)}
              className="px-3 py-1 text-xs rounded-md"
              style={{ backgroundColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showStopAllConfirm && (
        <div
          className="mb-4 p-3 rounded-lg border"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgb(239, 68, 68)',
          }}
        >
          <p className="text-sm mb-2" style={{ color: `rgb(var(--text-primary))` }}>
            Stop flow for {eligibleForFlowStop.length} flowing ticket{eligibleForFlowStop.length === 1 ? '' : 's'}?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStopFlowAll}
              className="px-3 py-1 text-xs rounded-md"
              style={{ backgroundColor: 'rgb(239, 68, 68)', color: 'white' }}
            >
              Stop All
            </button>
            <button
              type="button"
              onClick={() => setShowStopAllConfirm(false)}
              className="px-3 py-1 text-xs rounded-md"
              style={{ backgroundColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 min-h-[200px] max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
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
              draggable={true}
              onDragStart={(e) => {
                e.stopPropagation()
                onTicketDragStart?.(ticket.id)
              }}
              className="p-3 rounded-lg border cursor-move transition-all hover:shadow-md"
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
                opacity: draggedTicketId === ticket.id ? 0.5 : (ticket.creation_status === 'draft' ? 0.8 : 1),
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
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
