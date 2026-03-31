'use client'

import React from 'react'
import { Modal } from '@/components/ui/modal'
import type { Status } from '@/lib/db/schema'

interface DeleteStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  status: Status | null
  isDeleting?: boolean
}

export function DeleteStatusModal({
  isOpen,
  onClose,
  onConfirm,
  status,
  isDeleting = false,
}: DeleteStatusModalProps) {
  if (!status) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Status"
      dismissible={!isDeleting}
    >
      <div className="space-y-4">
        <p style={{ color: `rgb(var(--text-secondary))` }}>
          Are you sure you want to delete the status{' '}
          <span
            className="font-medium"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            "{status.name}"
          </span>
          ? This action cannot be undone.
        </p>

        <div
          className="flex items-center gap-2 rounded-md border p-3"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderColor: `rgb(var(--border-color))`,
          }}
        >
          <div
            className="h-4 w-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: status.color }}
          />
          <span
            className="font-medium"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            {status.name}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-md px-4 py-2 font-medium transition-colors"
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
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-md px-4 py-2 font-medium text-white transition-colors disabled:opacity-50"
            style={{
              backgroundColor: '#EF4444',
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.backgroundColor = '#DC2626'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#EF4444'
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Status'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
