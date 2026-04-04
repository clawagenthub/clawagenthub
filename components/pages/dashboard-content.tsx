'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { BoardColumn } from '@/components/board/board-column'
import { TicketModal, TicketViewModal } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { useUser, useStatuses, useCreateTicket, useUpdateTicket, useUpdateTicketFlowConfig, useTickets, useDeleteTicket } from '@/lib/query/hooks'
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
  
  // Ticket creation
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false)
  const [isTicketViewModalOpen, setIsTicketViewModalOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<TicketWithRelations | null>(null)
  const [viewingTicket, setViewingTicket] = useState<TicketWithRelations | null>(null)
  const createMutation = useCreateTicket()
  const updateMutation = useUpdateTicket()
  const updateFlowConfigMutation = useUpdateTicketFlowConfig()
  
  // Show drafts toggle state
  const [showDrafts, setShowDrafts] = useState(false)
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null)

  // Multi-select state
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([])

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [flowStatusFilter, setFlowStatusFilter] = useState<string>('all')

  // Delete mutation
  const deleteMutation = useDeleteTicket()

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

  // Ticket drag handlers - for moving tickets between statuses
  const handleTicketDragStart = (ticketId: string) => {
    setDraggedTicketId(ticketId)
  }

  const handleTicketDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleTicketDrop = async (e: React.DragEvent, targetStatusId: string) => {
    e.preventDefault()
    
    if (!draggedTicketId) {
      return
    }

    // Find the ticket being dragged
    const ticket = tickets.find(t => t.id === draggedTicketId)
    
    if (!ticket || ticket.status_id === targetStatusId) {
      setDraggedTicketId(null)
      return
    }

    // Update the ticket's status
    try {
      await updateMutation.mutateAsync({
        id: ticket.id,
        status_id: targetStatusId,
      })
    } catch (error) {
      console.error('Failed to move ticket:', error)
      alert(error instanceof Error ? error.message : 'Failed to move ticket')
    }

    setDraggedTicketId(null)
  }

  async function handleCreateTicket(data: any, switchToView = false) {
    if (data?.id) {
      try {
        const updatedTicket = await updateMutation.mutateAsync({
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

  // Filter tickets based on search and status filter
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesSearch = searchQuery === '' || 
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ticket.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      const matchesFlowStatus = flowStatusFilter === 'all' || ticket.flowing_status === flowStatusFilter
      return matchesSearch && matchesFlowStatus
    })
  }, [tickets, searchQuery, flowStatusFilter])

  // Selection handlers
  const handleTicketSelect = (ticketId: string, selected: boolean) => {
    if (selected) {
      setSelectedTicketIds(prev => [...prev, ticketId])
    } else {
      setSelectedTicketIds(prev => prev.filter(id => id !== ticketId))
    }
  }

  const handleSelectAllInColumn = (statusId: string, selected: boolean) => {
    const columnTicketIds = filteredTickets
      .filter(t => t.status_id === statusId && t.creation_status === 'active')
      .map(t => t.id)
    
    if (selected) {
      setSelectedTicketIds(prev => {
        const existing = new Set(prev)
        columnTicketIds.forEach(id => existing.add(id))
        return Array.from(existing)
      })
    } else {
      setSelectedTicketIds(prev => prev.filter(id => !columnTicketIds.includes(id)))
    }
  }

  const isAllSelectedInColumn = (statusId: string) => {
    const columnTicketIds = filteredTickets
      .filter(t => t.status_id === statusId && t.creation_status === 'active')
      .map(t => t.id)
    return columnTicketIds.length > 0 && columnTicketIds.every(id => selectedTicketIds.includes(id))
  }

  const isSomeSelectedInColumn = (statusId: string) => {
    const columnTicketIds = filteredTickets
      .filter(t => t.status_id === statusId && t.creation_status === 'active')
      .map(t => t.id)
    const selectedCount = columnTicketIds.filter(id => selectedTicketIds.includes(id)).length
    return selectedCount > 0 && selectedCount < columnTicketIds.length
  }

  // Bulk action handlers
  const handleBulkMoveTo = async (targetStatusId: string) => {
    if (selectedTicketIds.length === 0) return
    try {
      await Promise.all(selectedTicketIds.map(ticketId => 
        updateMutation.mutateAsync({ id: ticketId, status_id: targetStatusId })
      ))
      setSelectedTicketIds([])
    } catch (error) {
      console.error('Failed to move tickets:', error)
      alert(error instanceof Error ? error.message : 'Failed to move tickets')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedTicketIds.length === 0) return
    const confirmed = window.confirm(`Delete ${selectedTicketIds.length} selected ticket(s)? This cannot be undone.`)
    if (!confirmed) return
    try {
      await Promise.all(selectedTicketIds.map(ticketId => 
        deleteMutation.mutateAsync(ticketId)
      ))
      setSelectedTicketIds([])
    } catch (error) {
      console.error('Failed to delete tickets:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete tickets')
    }
  }

  // Check if all active tickets in a column are selected
  const getColumnSelectedCount = (statusId: string) => {
    return filteredTickets
      .filter(t => t.status_id === statusId && t.creation_status === 'active')
      .filter(t => selectedTicketIds.includes(t.id)).length
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
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickets..."
                className="pl-9 pr-4 py-2 rounded-lg text-sm border w-64"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))',
                }}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'rgb(var(--text-tertiary))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Flow Status Filter */}
            <select
              value={flowStatusFilter}
              onChange={(e) => setFlowStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border"
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                borderColor: 'rgb(var(--border-color))',
                color: 'rgb(var(--text-primary))',
              }}
            >
              <option value="all">All Flow Status</option>
              <option value="flowing">Flowing</option>
              <option value="failed">Failed</option>
              <option value="waiting">Waiting</option>
              <option value="waiting_to_flow">Waiting to Flow</option>
              <option value="stopped">Stopped</option>
              <option value="completed">Completed</option>
            </select>

{/* Bulk Actions Dropdown */}
            {selectedTicketIds.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  style={{
                    backgroundColor: 'rgb(var(--accent-primary, 59 130, 246))',
                    color: 'white',
                  }}
                >
                  {selectedTicketIds.length} Selected ▼
                </button>
                <div
                  className="absolute right-0 mt-2 w-48 rounded-lg border shadow-lg z-50"
                  style={{
                    backgroundColor: 'rgb(var(--bg-primary))',
                    borderColor: 'rgb(var(--border-color))',
                  }}
                >
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs font-semibold" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Move to Status
                    </div>
                    {statuses.map(status => (
                      <button
                        key={status.id}
                        onClick={() => handleBulkMoveTo(status.id)}
                        className="flex w-full items-center px-4 py-2 text-left text-sm transition-colors"
                        style={{ color: 'rgb(var(--text-primary))' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--bg-secondary))'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: status.color }} />
                        {status.name}
                      </button>
                    ))}
                    <div
                      className="my-1 border-t"
                      style={{ borderColor: 'rgb(var(--border-color))' }}
                    />
                    <button
                      onClick={handleBulkDelete}
                      className="flex w-full items-center px-4 py-2 text-left text-sm transition-colors"
                      style={{ color: 'rgb(220, 38, 38)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              </div>
            )}

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
              {showDrafts ? 'Drafts: ON' : 'Drafts: OFF'}
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
                      tickets={filteredTickets.filter(t => t.status_id === status.id)}
                      showDrafts={showDrafts}
                      onTicketDoubleClick={handleTicketDoubleClick}
                      onTicketDragStart={handleTicketDragStart}
                      onTicketDragOver={handleTicketDragOver}
                      onTicketDrop={handleTicketDrop}
                      draggedTicketId={draggedTicketId}
                      selectedTicketIds={selectedTicketIds}
                      onTicketSelect={handleTicketSelect}
                      onSelectAll={(selected) => handleSelectAllInColumn(status.id, selected)}
                      isAllSelected={isAllSelectedInColumn(status.id)}
                      isSomeSelected={isSomeSelectedInColumn(status.id)}
                      selectedCount={getColumnSelectedCount(status.id)}
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
          onSaveAndView={editingTicket ? handleSwitchToViewFromEdit : undefined}
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
