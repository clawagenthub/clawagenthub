'use client'

import React, { useState, useMemo } from 'react'
import type { TicketWithRelations } from '@/lib/query/hooks'
import { useBulkStartTicketFlow, useBulkStopTicketFlow } from '@/lib/query/hooks'
import { Toast } from '@/components/ui/toast'
import { TicketCard } from './lib/ticket-card'
import type { StartAllConfirmProps, StopAllConfirmProps } from './lib/board-types'
import logger, { logCategories } from '@/lib/logger/index.js'


function StartAllConfirm({ count, onConfirm, onCancel }: StartAllConfirmProps) {
  return (
    <div
      className="mb-4 p-3 rounded-lg border"
      style={{
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgb(16, 185, 129)',
      }}
    >
      <p className="text-sm mb-2" style={{ color: `rgb(var(--text-primary))` }}>
        Start flow for {count} eligible ticket{count === 1 ? '' : 's'}?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="px-3 py-1 text-xs rounded-md"
          style={{ backgroundColor: 'rgb(16, 185, 129)', color: 'white' }}
        >
          Start All
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded-md"
          style={{ backgroundColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function StopAllConfirm({ count, onConfirm, onCancel }: StopAllConfirmProps) {
  return (
    <div
      className="mb-4 p-3 rounded-lg border"
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgb(239, 68, 68)',
      }}
    >
      <p className="text-sm mb-2" style={{ color: `rgb(var(--text-primary))` }}>
        Stop flow for {count} flowing ticket{count === 1 ? '' : 's'}?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="px-3 py-1 text-xs rounded-md"
          style={{ backgroundColor: 'rgb(239, 68, 68)', color: 'white' }}
        >
          Stop All
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded-md"
          style={{ backgroundColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ColumnHeader({
  statusId,
  activeTicketsForSelection,
  title,
  color,
  draftCount,
  selectedCount,
  isAllSelected,
  isSomeSelected,
  eligibleForFlowStart,
  eligibleForFlowStop,
  showStopAll,
  isBulkStartingFlow,
  isBulkStoppingFlow,
  onSelectAll,
  onStartAllClick,
  onStopAllClick,
}: {
  statusId: string
  activeTicketsForSelection: TicketWithRelations[]
  title: string
  color: string
  draftCount: number
  selectedCount: number
  isAllSelected: boolean
  isSomeSelected: boolean
  eligibleForFlowStart: TicketWithRelations[]
  eligibleForFlowStop: TicketWithRelations[]
  showStopAll: boolean
  isBulkStartingFlow: boolean
  isBulkStoppingFlow: boolean
  onSelectAll: (statusId: string, selected: boolean) => void
  onStartAllClick: () => void
  onStopAllClick: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {activeTicketsForSelection.length > 0 && (
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = isSomeSelected
            }}
            onChange={(e) => onSelectAll(statusId, e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
            title="Select all in column"
          />
        )}
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="font-semibold" style={{ color: `rgb(var(--text-primary))` }}>
          {title}
        </h3>
        {draftCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(156, 163, 175, 0.2)', color: 'rgb(var(--text-tertiary))' }}>
            {draftCount} draft{draftCount !== 1 ? 's' : ''}
          </span>
        )}
        {selectedCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: 'rgb(59, 130, 246)' }}>
            {selectedCount} selected
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showStopAll ? (
          <button
            type="button"
            onClick={onStopAllClick}
            disabled={isBulkStoppingFlow}
            className="px-2 py-1 text-xs rounded-md transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'rgb(239, 68, 68)', color: 'white' }}
            title="Stop Flow for all flowing tickets"
          >
            {isBulkStoppingFlow ? 'Stopping...' : `■ Stop All (${eligibleForFlowStop.length})`}
          </button>
        ) : eligibleForFlowStart.length > 0 && (
          <button
            type="button"
            onClick={onStartAllClick}
            disabled={isBulkStartingFlow}
            className="px-2 py-1 text-xs rounded-md transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'rgb(16, 185, 129)', color: 'white' }}
            title="Start Flow for all eligible tickets"
          >
            {isBulkStartingFlow ? 'Starting...' : `▶ Start All (${eligibleForFlowStart.length})`}
          </button>
        )}
        <button type="button" className="transition-colors" style={{ color: `rgb(var(--text-tertiary))` }}>
          ⋮
        </button>
      </div>
    </div>
  )
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
  selectedTicketIds?: string[]
  onTicketSelect?: (ticketId: string, selected: boolean) => void
  onSelectAll?: (statusId: string, selected: boolean) => void
  isAllSelected?: boolean
  isSomeSelected?: boolean
  selectedCount?: number
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
  selectedTicketIds = [],
  onTicketSelect,
  onSelectAll,
  isAllSelected = false,
  isSomeSelected = false,
  selectedCount = 0,
}: BoardColumnProps) {
  const { mutateAsync: bulkStartFlow, isPending: isBulkStartingFlow } = useBulkStartTicketFlow()
  const { mutateAsync: bulkStopFlow, isPending: isBulkStoppingFlow } = useBulkStopTicketFlow()
  const [showStartAllConfirm, setShowStartAllConfirm] = useState(false)
  const [showStopAllConfirm, setShowStopAllConfirm] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const visibleTickets = useMemo(() => {
    const filtered = tickets.filter(ticket => {
      if (ticket.creation_status === 'active') return true
      return showDrafts && ticket.creation_status === 'draft'
    })
    return filtered.sort((a, b) => {
      const aFlowing = a.flowing_status === 'flowing' ? 1 : 0
      const bFlowing = b.flowing_status === 'flowing' ? 1 : 0
      return bFlowing - aFlowing
    })
  }, [tickets, showDrafts])

  const draftCount = tickets.filter(t => t.creation_status === 'draft').length
  const activeTicketsForSelection = visibleTickets.filter(t => t.creation_status === 'active')

  // Fix #1: exclude waiting_to_flow from eligibleForFlowStart
  const eligibleForFlowStart = visibleTickets.filter(
    t => t.flow_enabled && 
       t.creation_status === 'active' && 
       t.flowing_status !== 'flowing' &&
       t.flowing_status !== 'waiting_to_flow'
  )

  // Fix #2: include waiting_to_flow in eligibleForFlowStop and show Stop when ANY needs stopping
  const eligibleForFlowStop = visibleTickets.filter(
    t => t.flow_enabled && 
       t.creation_status === 'active' && 
       (t.flowing_status === 'flowing' || t.flowing_status === 'waiting_to_flow')
  )

  // Stop All takes priority - show when ANY ticket needs stopping
  const showStopAll = eligibleForFlowStop.length > 0

  const handleStartFlowAll = async () => {
    if (eligibleForFlowStart.length === 0) return
    try {
      const ticketIds = eligibleForFlowStart.map(t => t.id)
      await bulkStartFlow(ticketIds)
      setShowStartAllConfirm(false)
    } catch (error) {
      logger.error('Failed to start flow for all tickets:', error)
      setToast({ message: error instanceof Error ? error.message : 'Failed to start flow', type: 'error' })
    }
  }

  const handleStopFlowAll = async () => {
    if (eligibleForFlowStop.length === 0) return
    try {
      const ticketIds = eligibleForFlowStop.map(t => t.id)
      await bulkStopFlow(ticketIds)
      setShowStopAllConfirm(false)
    } catch (error) {
      logger.error('Failed to stop flow for all tickets:', error)
      setToast({ message: error instanceof Error ? error.message : 'Failed to stop flow', type: 'error' })
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
      <ColumnHeader
        statusId={id}
        activeTicketsForSelection={activeTicketsForSelection}
        title={title}
        color={color}
        draftCount={draftCount}
        selectedCount={selectedCount}
        isAllSelected={isAllSelected}
        isSomeSelected={isSomeSelected}
        eligibleForFlowStart={eligibleForFlowStart}
        eligibleForFlowStop={eligibleForFlowStop}
        showStopAll={showStopAll}
        isBulkStartingFlow={isBulkStartingFlow}
        isBulkStoppingFlow={isBulkStoppingFlow}
        onSelectAll={onSelectAll ?? (() => {})}
        onStartAllClick={() => setShowStartAllConfirm(true)}
        onStopAllClick={() => setShowStopAllConfirm(true)}
      />

      {showStartAllConfirm && (
        <StartAllConfirm count={eligibleForFlowStart.length} onConfirm={handleStartFlowAll} onCancel={() => setShowStartAllConfirm(false)} />
      )}
      {showStopAllConfirm && (
        <StopAllConfirm count={eligibleForFlowStop.length} onConfirm={handleStopFlowAll} onCancel={() => setShowStopAllConfirm(false)} />
      )}

      <div className="space-y-2 min-h-[200px] max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
        {visibleTickets.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: `rgb(var(--text-secondary))` }}>
            {showDrafts && draftCount > 0 ? `No active tickets. ${draftCount} draft ticket${draftCount !== 1 ? 's' : ''} hidden.` : 'No tickets'}
          </p>
        ) : (
          visibleTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              isSelected={selectedTicketIds.includes(ticket.id)}
              isDragging={draggedTicketId === ticket.id}
              selectedTicketIds={selectedTicketIds}
              onSelect={onTicketSelect}
              onDoubleClick={onTicketDoubleClick}
              onDragStart={onTicketDragStart}
            />
          ))
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
