'use client'

import { useState } from 'react'
import { StatusList } from '@/components/status/status-list'
import { StatusModal } from '@/components/status/status-modal'
import { DeleteStatusModal } from '@/components/status/delete-status-modal'
import { useStatuses } from '@/lib/query/hooks/useStatuses'
import type { PageContentProps } from './index'
import type { Status } from '@/lib/db/schema'

export function StatusesPageContent({ user }: PageContentProps) {
  const { data: statuses = [], isLoading, error } = useStatuses()

  const [showModal, setShowModal] = useState(false)
  const [editingStatus, setEditingStatus] = useState<Status | null>(null)
  const [deletingStatus, setDeletingStatus] = useState<Status | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if user can manage statuses (owner or admin)
  const canManage = true // TODO: Check user role in workspace

  const handleEdit = (status: Status) => {
    setEditingStatus(status)
    setShowModal(true)
  }

  const handleDelete = (status: Status) => {
    setDeletingStatus(status)
  }

  const handleCreate = () => {
    setEditingStatus(null)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingStatus(null)
  }

  const handleSubmit = async (data: { name: string; color: string; description?: string; priority?: number; agent_id?: string | null }) => {
    console.log('[DEBUG] handleSubmit called with data:', data)
    setIsSubmitting(true)
    try {
      let response
      if (editingStatus) {
        // Update existing status
        console.log('[DEBUG] Updating status:', editingStatus.id)
        response = await fetch(`/api/statuses/${editingStatus.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      } else {
        // Create new status
        console.log('[DEBUG] Creating new status')
        response = await fetch('/api/statuses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }
      console.log('[DEBUG] Response status:', response.status, response.statusText)
      
      const responseText = await response.text()
      console.log('[DEBUG] Response body:', responseText)
      
      if (!response.ok) {
        const errorData = responseText ? JSON.parse(responseText) : { message: 'Unknown error' }
        throw new Error(errorData.message || `Failed to save status (${response.status})`)
      }
      
      setShowModal(false)
      setEditingStatus(null)
      // Refetch is handled by TanStack Query's invalidation
      window.location.reload() // Simple refresh to ensure data is updated
    } catch (error) {
      console.error('Error saving status:', error)
      alert(error instanceof Error ? error.message : 'Failed to save status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingStatus) return

    setIsSubmitting(true)
    try {
      await fetch(`/api/statuses/${deletingStatus.id}`, {
        method: 'DELETE',
      })
      setDeletingStatus(null)
      window.location.reload() // Simple refresh to ensure data is updated
    } catch (error) {
      console.error('Error deleting status:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete status')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl font-bold"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            Statuses
          </h1>
          <p className="mt-2" style={{ color: `rgb(var(--text-secondary))` }}>
            Manage workspace status labels for tracking progress and organization
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4" style={{ color: `rgb(var(--text-secondary))` }}>
              Loading statuses...
            </p>
          </div>
        ) : error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
            role="alert"
          >
            <p className="font-medium">Error loading statuses</p>
            <p className="text-sm">
              {error instanceof Error ? error.message : 'An unknown error occurred'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-end">
              {canManage && (
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-2 rounded-md px-4 py-2 font-medium text-white transition-colors"
                  style={{
                    backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgb(37, 99, 235)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `rgb(var(--accent-primary, 59 130 246))`
                  }}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Status
                </button>
              )}
            </div>

            <StatusList
              statuses={statuses}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canManage={canManage}
            />
          </>
        )}
      </div>

      <StatusModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSubmit={handleSubmit}
        status={editingStatus}
        isSubmitting={isSubmitting}
      />

      <DeleteStatusModal
        isOpen={!!deletingStatus}
        onClose={() => setDeletingStatus(null)}
        onConfirm={handleConfirmDelete}
        status={deletingStatus}
        isDeleting={isSubmitting}
      />
    </>
  )
}
