'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { BoardColumn } from '@/components/board/board-column'
import { TicketModal, TicketViewModal } from '@/components/tickets'
import {
  useUser,
  useStatuses,
  useCreateTicket,
  useUpdateTicket,
  useUpdateTicketFlowConfig,
  useTickets,
  useDeleteTicket,
} from '@/lib/query/hooks'
import type { TicketWithRelations } from '@/lib/query/hooks'
import type { PageContentProps } from './index'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import logger, { logCategories as _logCategories } from '@/lib/logger/index.js'
import {
  BoardLoadingState,
  BoardErrorState,
  BoardEmptyState,
} from '@/components/dashboard/board-states'

// Selection logic inlined into component

// Bulk action handlers
function useBulkActions(
  selectedTicketIds: string[],
  updateMutation: any,
  deleteMutation: any
) {
  const handleBulkMoveTo = async (targetStatusId: string) => {
    if (selectedTicketIds.length === 0) return
    try {
      await Promise.all(
        selectedTicketIds.map((ticketId) =>
          updateMutation.mutateAsync({
            id: ticketId,
            status_id: targetStatusId,
          })
        )
      )
    } catch (error) {
      logger.error('Failed to move tickets:', error)
      alert(error instanceof Error ? error.message : 'Failed to move tickets')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedTicketIds.length === 0) return
    const confirmed = window.confirm(
      `Delete ${selectedTicketIds.length} selected ticket(s)? This cannot be undone.`
    )
    if (!confirmed) return
    try {
      await Promise.all(
        selectedTicketIds.map((ticketId) =>
          deleteMutation.mutateAsync(ticketId)
        )
      )
    } catch (error) {
      logger.error('Failed to delete tickets:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete tickets')
    }
  }

  return { handleBulkMoveTo, handleBulkDelete }
}

// Ticket drag handlers
function useTicketDrag(tickets: TicketWithRelations[], updateMutation: any) {
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null)

  const handleTicketDragStart = (ticketId: string) => {
    setDraggedTicketId(ticketId)
  }

  const handleTicketDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleTicketDrop = async (
    e: React.DragEvent,
    targetStatusId: string
  ) => {
    e.preventDefault()
    if (!draggedTicketId) return

    const ticket = tickets.find((t) => t.id === draggedTicketId)
    if (!ticket || ticket.status_id === targetStatusId) {
      setDraggedTicketId(null)
      return
    }

    try {
      await updateMutation.mutateAsync({
        id: ticket.id,
        status_id: targetStatusId,
      })
    } catch (error) {
      logger.error('Failed to move ticket:', error)
      alert(error instanceof Error ? error.message : 'Failed to move ticket')
    }

    setDraggedTicketId(null)
  }

  return {
    draggedTicketId,
    handleTicketDragStart,
    handleTicketDragOver,
    handleTicketDrop,
  }
}

export function DashboardPageContent({ user: _user }: PageContentProps) {
  // Use TanStack Query hook for user state management with auto-refresh
  const { mustChangePassword, refetch: _refetch } = useUser()

  // Fetch statuses from the API (ordered by priority)
  const {
    data: statuses = [],
    isLoading,
    error,
    refetch: refetchStatuses,
  } = useStatuses()

  // Ticket creation
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [isTicketViewModalOpen, setIsTicketViewModalOpen] = useState(false)
  const [editingTicket, setEditingTicket] =
    useState<TicketWithRelations | null>(null)
  const [viewingTicket, setViewingTicket] =
    useState<TicketWithRelations | null>(null)
  const createMutation = useCreateTicket()
  const updateMutation = useUpdateTicket()
  const updateFlowConfigMutation = useUpdateTicketFlowConfig()
  const deleteMutation = useDeleteTicket()

  // Show drafts toggle state
  const [showDrafts, setShowDrafts] = useState(false)

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  // Multi-select state
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([])

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [flowStatusFilter, setFlowStatusFilter] = useState<string>('all')

  // Fetch tickets with drafts based on toggle
  const { data: tickets = [] } = useTickets({ include_drafts: showDrafts })

  useEffect(() => {
    if (mustChangePassword) {
      setIsPasswordModalOpen(true)
    }
  }, [mustChangePassword])

  const handlePasswordChangeSuccess = () => {
    setIsPasswordModalOpen(false)
    alert('Password changed successfully!')
  }

  const handleModalClose = () => {
    if (!mustChangePassword) {
      setIsPasswordModalOpen(false)
    }
  }

  // Ticket drag handlers
  const {
    draggedTicketId,
    handleTicketDragStart,
    handleTicketDragOver,
    handleTicketDrop,
  } = useTicketDrag(tickets, updateMutation)

  // Filter tickets based on search and status filter
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        searchQuery === '' ||
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ticket.description
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ??
          false)
      const matchesFlowStatus =
        flowStatusFilter === 'all' || ticket.flowing_status === flowStatusFilter
      return matchesSearch && matchesFlowStatus
    })
  }, [tickets, searchQuery, flowStatusFilter])

  // Selection handlers
  const handleTicketSelect = (ticketId: string, selected: boolean) => {
    if (selected) {
      setSelectedTicketIds((prev) => [...prev, ticketId])
    } else {
      setSelectedTicketIds((prev) => prev.filter((id) => id !== ticketId))
    }
  }


  const handleSelectAllInColumn = (
    statusId: string,
    selected: boolean
  ) => {
    const columnTicketIds = filteredTickets
      .filter((t) => t.status_id === statusId && t.creation_status === 'active')
      .map((t) => t.id)

    if (selected) {
      setSelectedTicketIds((prev) => {
        const existing = new Set(prev)
        columnTicketIds.forEach((id) => existing.add(id))
        return Array.from(existing)
      })
    } else {
      setSelectedTicketIds((prev) =>
        prev.filter((id) => !columnTicketIds.includes(id))
      )
    }
  }

  const isAllSelectedInColumn = (statusId: string) => {
    const columnTicketIds = filteredTickets
      .filter((t) => t.status_id === statusId && t.creation_status === 'active')
      .map((t) => t.id)
    return (
      columnTicketIds.length > 0 &&
      columnTicketIds.every((id) => selectedTicketIds.includes(id))
    )
  }

  const isSomeSelectedInColumn = (statusId: string) => {
    const columnTicketIds = filteredTickets
      .filter((t) => t.status_id === statusId && t.creation_status === 'active')
      .map((t) => t.id)
    const selectedCount = columnTicketIds.filter((id) =>
      selectedTicketIds.includes(id)
    ).length
    return selectedCount > 0 && selectedCount < columnTicketIds.length
  }

  const getColumnSelectedCount = (statusId: string) => {
    return filteredTickets
      .filter((t) => t.status_id === statusId && t.creation_status === 'active')
      .filter((t) => selectedTicketIds.includes(t.id)).length
  }

  // Bulk action handlers
  const { handleBulkMoveTo, handleBulkDelete } = useBulkActions(
    selectedTicketIds,
    updateMutation,
    deleteMutation
  )

  // Bulk action handlers
  async function handleCreateTicket(data: any, switchToView = false) {
    if (data?.id) {
      try {
        const _updatedTicket = await updateMutation.mutateAsync({
          id: data.id,
          title: data.title,
          description: data.description,
          status_id: data.status_id,
          assigned_to: data.assigned_to ?? null,
          project_id: data.project_id ?? null,
          flow_enabled: data.flow_enabled,
          flow_mode: data.flow_mode,
          creation_status: data.creation_status,
        })

        if (data.flow_enabled && Array.isArray(data.flow_configs)) {
          await updateFlowConfigMutation.mutateAsync({
            ticketId: data.id,
            configs: data.flow_configs,
          })
        }

        if (switchToView && editingTicket) {
          setViewingTicket(editingTicket)
          setIsTicketModalOpen(false)
          setEditingTicket(null)
          setIsTicketViewModalOpen(true)
        } else {
          setIsTicketModalOpen(false)
          setEditingTicket(null)
        }
      } catch (error) {
        logger.error('Failed to update ticket:', error)
      }
      return
    }

    createMutation.mutate(data, {
      onSuccess: () => {
        setIsTicketModalOpen(false)
        setEditingTicket(null)
      },
    })
  }

  async function handleDeleteDraft(ticketId: string) {
    const confirmed = window.confirm(
      'Delete this draft? This cannot be undone.'
    )
    if (!confirmed) return

    try {
      await deleteMutation.mutateAsync(ticketId)
      setIsTicketModalOpen(false)
      setEditingTicket(null)
    } catch (error) {
      logger.error('Failed to delete draft:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete draft')
    }
  }

  function handleTicketDoubleClick(ticket: TicketWithRelations) {
    if (ticket.creation_status === 'draft') {
      setEditingTicket(ticket)
      setIsTicketModalOpen(true)
      return
    }

    setViewingTicket(ticket)
    setIsTicketViewModalOpen(true)
  }

  function handleCloseTicketModal() {
    setIsTicketModalOpen(false)
    setEditingTicket(null)
  }

  function handleCloseTicketViewModal() {
    setIsTicketViewModalOpen(false)
    setViewingTicket(null)
  }

  function handleSwitchToEditFromView() {
    if (!viewingTicket) return
    setEditingTicket(viewingTicket)
    setIsTicketViewModalOpen(false)
    setIsTicketModalOpen(true)
  }

  function handleSwitchToViewFromEdit() {
    if (!editingTicket) return
    setViewingTicket(editingTicket)
    setIsTicketModalOpen(false)
    setIsTicketViewModalOpen(true)
  }

  function handleViewParentTicket(parentTicketId: string) {
    const parentTicket = tickets.find((t) => t.id === parentTicketId)
    if (parentTicket) {
      setViewingTicket(parentTicket)
      setIsTicketViewModalOpen(true)
    } else {
      setViewingTicket({ id: parentTicketId } as TicketWithRelations)
      setIsTicketViewModalOpen(true)
    }
  }

  function handleAddTicket() {
    setEditingTicket(null)
    setIsTicketModalOpen(true)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header with Add Ticket button and Show Drafts toggle */}
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          flowStatusFilter={flowStatusFilter}
          onFlowStatusFilterChange={setFlowStatusFilter}
          selectedTicketIds={selectedTicketIds}
          statuses={statuses}
          onBulkMoveTo={handleBulkMoveTo}
          onBulkDelete={handleBulkDelete}
          showDrafts={showDrafts}
          onShowDraftsChange={setShowDrafts}
          onAddTicket={handleAddTicket}
        />

        {/* Board System - Slider-style horizontal scroll with 3 visible items per row */}
        <div className="dashboard-slider min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-auto">
          <div className="flex min-w-max flex-row items-stretch gap-4 pb-4">
            {isLoading ? (
              <BoardLoadingState count={6} />
            ) : error ? (
              <BoardErrorState
                error={error}
                onRetry={() => refetchStatuses()}
              />
            ) : statuses.length === 0 ? (
              <BoardEmptyState />
            ) : (
              statuses.map((status) => (
                <div
                  key={status.id}
                  className="h-full w-[calc((100vw-12rem-4rem)/3)] flex-shrink-0 snap-start"
                >
                  <BoardColumn
                    id={status.id}
                    title={status.name}
                    color={status.color}
                    tickets={filteredTickets.filter(
                      (t) => t.status_id === status.id
                    )}
                    showDrafts={showDrafts}
                    onTicketDoubleClick={handleTicketDoubleClick}
                    onTicketDragStart={handleTicketDragStart}
                    onTicketDragOver={handleTicketDragOver}
                    onTicketDrop={handleTicketDrop}
                    draggedTicketId={draggedTicketId}
                    selectedTicketIds={selectedTicketIds}
                    onTicketSelect={handleTicketSelect}
                    onSelectAll={handleSelectAllInColumn}
                    isAllSelected={isAllSelectedInColumn(status.id)}
                    isSomeSelected={isSomeSelectedInColumn(status.id)}
                    selectedCount={getColumnSelectedCount(status.id)}
                    allFlowingTickets={filteredTickets.filter(
                      (t) => t.flowing_status === 'flowing'
                    )}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Ticket Modal */}
      {isTicketModalOpen && (
        <TicketModal
          isOpen={isTicketModalOpen}
          onClose={handleCloseTicketModal}
          onSubmit={handleCreateTicket}
          onDelete={
            editingTicket?.creation_status === 'draft'
              ? () => handleDeleteDraft(editingTicket.id)
              : undefined
          }
          isSubmitting={createMutation.isPending}
          onSwitchToView={handleSwitchToViewFromEdit}
          onSaveAndView={editingTicket ? handleSwitchToViewFromEdit : undefined}
          initialData={
            editingTicket
              ? {
                  id: editingTicket.id,
                  title: editingTicket.title,
                  description: editingTicket.description || '',
                  status_id: editingTicket.status_id,
                  assigned_to: editingTicket.assigned_to_id || '',
                  flow_enabled: editingTicket.flow_enabled,
                  flow_mode: editingTicket.flow_mode,
                  creation_status: editingTicket.creation_status,
                  project_id: editingTicket.project_id || '',
                }
              : undefined
          }
        />
      )}

      {isTicketViewModalOpen && (
        <TicketViewModal
          isOpen={isTicketViewModalOpen}
          ticketId={viewingTicket?.id || null}
          onClose={handleCloseTicketViewModal}
          onSwitchToEdit={handleSwitchToEditFromView}
          onViewParent={handleViewParentTicket}
        />
      )}

      {/* Password Change Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={handleModalClose}
        title={
          mustChangePassword ? '🔒 Password Change Required' : 'Change Password'
        }
        dismissible={!mustChangePassword}
      >
        <ChangePasswordForm
          onSuccess={handlePasswordChangeSuccess}
          onCancel={mustChangePassword ? undefined : handleModalClose}
          isForced={mustChangePassword}
        />
      </Modal>
    </>
  )
}
