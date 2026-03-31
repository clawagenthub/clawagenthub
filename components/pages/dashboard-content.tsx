'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { BoardColumn } from '@/components/board/board-column'
import { TicketModal, TicketViewModal } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useUser, useStatuses, useReorderStatuses, useCreateTicket, useUpdateTicket, useUpdateTicketFlowConfig, useDeleteTicket, useTickets } from '@/lib/query/hooks'
import type { TicketWithRelations } from '@/lib/query/hooks'
import type { PageContentProps } from './index'

// Local storage key for show drafts toggle
const SHOW_DRAFTS_KEY = 'dashboard-show-drafts'

// Get show drafts preference from localStorage
function getShowDraftsPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const value = localStorage.getItem(SHOW_DRAFTS_KEY)
    return value === 'true'
  } catch {
    return false
  }
}

// Save show drafts preference to localStorage
function setShowDraftsPreference(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SHOW_DRAFTS_KEY, String(value))
  } catch {
    // Ignore storage errors
  }
}

export function DashboardPageContent({ user }: PageContentProps) {
  const router = useRouter()
  
  // Use TanStack Query hook for user state management with auto-refresh
  const { mustChangePassword, refetch } = useUser()
  
  // Fetch statuses from the API (ordered by priority)
  const { data: statuses = [], isLoading, error, refetch: refetchStatuses } = useStatuses()
  
  // Reorder mutation for persisting drag-drop changes
  const reorderStatuses = useReorderStatuses()
  
  // Ticket creation
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [isTicketViewModalOpen, setIsTicketViewModalOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<TicketWithRelations | null>(null)
  const [viewingTicket, setViewingTicket] = useState<TicketWithRelations | null>(null)
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null)
  const createMutation = useCreateTicket()
  const updateMutation = useUpdateTicket()
  const updateFlowConfigMutation = useUpdateTicketFlowConfig()
  const deleteMutation = useDeleteTicket()
  
  // Show drafts toggle state
  const [showDrafts, setShowDrafts] = useState(false)
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [draggedStatusId, setDraggedStatusId] = useState<string | null>(null)

  // Load show drafts preference on mount
  useEffect(() => {
    setShowDrafts(getShowDraftsPreference())
  }, [])

  // Save show drafts preference when it changes
  useEffect(() => {
    setShowDraftsPreference(showDrafts)
  }, [showDrafts])

  // Fetch tickets with drafts based on toggle
  const { data: tickets = [] } = useTickets({ include_drafts: showDrafts })

  useEffect(() => {
    if (mustChangePassword) {
      setIsPasswordModalOpen(true)
    }
  }, [mustChangePassword])

  const handlePasswordChangeSuccess = () => {
    // TanStack Query automatically refetches user data via mutation
    setIsPasswordModalOpen(false)
    alert('Password changed successfully!')
  }

  const handleModalClose = () => {
    if (!mustChangePassword) {
      setIsPasswordModalOpen(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, statusId: string) => {
    setDraggedStatusId(statusId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetStatusId: string) => {
    e.preventDefault()
    
    if (!draggedStatusId || draggedStatusId === targetStatusId) {
      setDraggedStatusId(null)
      return
    }

    const draggedIndex = statuses.findIndex((s) => s.id === draggedStatusId)
    const targetIndex = statuses.findIndex((s) => s.id === targetStatusId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedStatusId(null)
      return
    }

    // Create new array with reordered statuses
    const newStatuses = [...statuses]
    const [draggedStatus] = newStatuses.splice(draggedIndex, 1)
    newStatuses.splice(targetIndex, 0, draggedStatus)

    // Calculate new priorities based on position
    const reorderItems = newStatuses.map((status, index) => ({
      id: status.id,
      priority: index + 1, // Start priorities at 1
    }))

    // Persist the new priorities to the database
    try {
      await reorderStatuses.mutateAsync(reorderItems)
    } catch (error) {
      console.error('Failed to reorder statuses:', error)
      // Refetch to restore correct order
      refetchStatuses()
    }

    setDraggedStatusId(null)
  }

  async function handleCreateTicket(data: any) {
    if (data?.id) {
      try {
        await updateMutation.mutateAsync({
          id: data.id,
          title: data.title,
          description: data.description,
          status_id: data.status_id,
          assigned_to: data.assigned_to ?? null,
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

        setIsTicketModalOpen(false)
        setEditingTicket(null)
      } catch (error) {
        console.error('Failed to update ticket:', error)
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

  async function handleDeleteTicket(ticket: TicketWithRelations) {
    const confirmed = window.confirm(
      `Delete ticket #${ticket.ticket_number} "${ticket.title}"? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      setDeletingTicketId(ticket.id)
      await deleteMutation.mutateAsync(ticket.id)
      if (editingTicket?.id === ticket.id) {
        handleCloseTicketModal()
      }
    } catch (error) {
      console.error('Failed to delete ticket:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete ticket')
    } finally {
      setDeletingTicketId(null)
    }
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header with Add Ticket button and Show Drafts toggle */}
        <div className="flex-shrink-0 mb-6 flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-bold"
              style={{ color: `rgb(var(--text-primary))` }}
            >
              Dashboard
            </h1>
            <p
              className="mt-2"
              style={{ color: `rgb(var(--text-secondary))` }}
            >
              Manage your boards and organize your work
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Show Drafts Toggle */}
            <button
              type="button"
              onClick={() => setShowDrafts(!showDrafts)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                showDrafts ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}
              style={{
                backgroundColor: showDrafts
                  ? 'rgba(59, 130, 246, 0.1)'
                  : 'rgb(var(--bg-secondary))',
                color: showDrafts
                  ? 'rgb(59, 130, 246)'
                  : 'rgb(var(--text-secondary))',
                border: '1px solid rgb(var(--border-color))',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = showDrafts
                  ? 'rgb(59, 130, 246)'
                  : 'rgb(var(--text-tertiary))'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgb(var(--border-color))'
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {showDrafts ? 'Drafts: ON 📝' : 'Drafts: OFF'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingTicket(null)
                setIsTicketModalOpen(true)
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Ticket
            </button>
          </div>
        </div>

        {/* Board System - Slider-style horizontal scroll with 3 visible items per row */}
        <div
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory dashboard-slider"
        >
          <div className="flex flex-row gap-4 h-full min-w-max items-stretch pb-6">
            {isLoading ? (
              // Loading skeleton - 3 visible items
              <>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="w-[calc((100vw-12rem-4rem)/3)] rounded-lg p-4 border-2 animate-pulse flex-shrink-0 snap-start"
                    style={{
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      borderColor: `rgb(var(--border-color))`,
                    }}
                  >
                    <div className="h-6 bg-gray-300 rounded mb-4 w-1/2"></div>
                    <div className="space-y-2">
                      <div className="h-20 bg-gray-200 rounded"></div>
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : error ? (
              // Error state with retry - spans full width
              <div
                className="col-span-3 flex flex-col items-center justify-center rounded-lg border p-12 max-w-md mx-auto"
                style={{
                  backgroundColor: `rgb(var(--bg-secondary))`,
                  borderColor: `rgb(var(--border-color))`,
                }}
              >
                <div className="mb-4 text-4xl">⚠️</div>
                <h3
                  className="mb-2 text-lg font-medium"
                  style={{ color: `rgb(var(--text-primary))` }}
                >
                  Error Loading Boards
                </h3>
                <p
                  className="mb-4 text-center"
                  style={{ color: `rgb(var(--text-secondary))` }}
                >
                  {error instanceof Error ? error.message : 'Failed to load status boards'}
                </p>
                <Button onClick={() => refetchStatuses()}>Retry</Button>
              </div>
            ) : statuses.length === 0 ? (
              // Empty state - spans full width
              <div
                className="col-span-3 flex flex-col items-center justify-center rounded-lg border p-12 max-w-md mx-auto"
                style={{
                  backgroundColor: `rgb(var(--bg-secondary))`,
                  borderColor: `rgb(var(--border-color))`,
                }}
              >
                <div className="mb-4 text-4xl">📋</div>
                <h3
                  className="mb-2 text-lg font-medium"
                  style={{ color: `rgb(var(--text-primary))` }}
                >
                  No Status Boards Yet
                </h3>
                <p
                  className="text-center"
                  style={{ color: `rgb(var(--text-secondary))` }}
                >
                  Create statuses in the Statuses page to see them as boards here.
                </p>
              </div>
            ) : (
              // Board columns with horizontal scroll - each item is 1/3 of viewport width
              <>
                {statuses.map((status) => (
                  <div
                    key={status.id}
                    className="w-[calc((100vw-12rem-4rem)/3)] h-full flex-shrink-0 snap-start"
                  >
                    <BoardColumn
                      id={status.id}
                      title={status.name}
                      color={status.color}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      tickets={tickets.filter(t => t.status_id === status.id)}
                      showDrafts={showDrafts}
                      onTicketDoubleClick={handleTicketDoubleClick}
                      onTicketDelete={handleDeleteTicket}
                      deletingTicketId={deletingTicketId}
                    />
                  </div>
                ))}
              </>
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
          isSubmitting={createMutation.isPending}
          onSwitchToView={handleSwitchToViewFromEdit}
          initialData={editingTicket ? {
            id: editingTicket.id,
            title: editingTicket.title,
            description: editingTicket.description || '',
            status_id: editingTicket.status_id,
            assigned_to: editingTicket.assigned_to_id || '',
            flow_enabled: editingTicket.flow_enabled,
            flow_mode: editingTicket.flow_mode,
            creation_status: editingTicket.creation_status,
          } : undefined}
        />
      )}

      {isTicketViewModalOpen && (
        <TicketViewModal
          isOpen={isTicketViewModalOpen}
          ticketId={viewingTicket?.id || null}
          onClose={handleCloseTicketViewModal}
          onSwitchToEdit={handleSwitchToEditFromView}
        />
      )}

      {/* Password Change Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={handleModalClose}
        title={mustChangePassword ? '🔒 Password Change Required' : 'Change Password'}
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
