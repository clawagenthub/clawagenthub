'use client'

import React from 'react'
import { Modal } from '@/components/ui/modal'
import { StatusForm, STATUS_COLORS } from './status-form'
import type { Status } from '@/lib/db/schema'

interface StatusModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    color: string
    description?: string
    priority?: number
    agent_id?: string | null
    is_flow_included?: boolean
    on_failed_goto?: string | null
    ask_approve_to_continue?: boolean
  }) => void
  status?: Status | null
  isSubmitting?: boolean
}

export function StatusModal({
  isOpen,
  onClose,
  onSubmit,
  status,
  isSubmitting = false,
}: StatusModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={status ? 'Edit Status' : 'Create Status'}
      dismissible={!isSubmitting}
    >
      <StatusForm
        initialName={status?.name || ''}
        initialColor={status?.color || STATUS_COLORS[0].value}
        initialDescription={status?.description || ''}
        initialPriority={status?.priority ?? 999}
        initialAgentId={status?.agent_id ?? null}
        initialIsFlowIncluded={status?.is_flow_included ?? false}
        initialOnFailedGoto={status?.on_failed_goto ?? null}
        initialAskApproveToContinue={status?.ask_approve_to_continue ?? false}
        editingStatusId={status?.id}
        onSubmit={onSubmit}
        onCancel={onClose}
        isSubmitting={isSubmitting}
        submitLabel={status ? 'Save Changes' : 'Create Status'}
        isEditing={!!status}
      />
    </Modal>
  )
}
