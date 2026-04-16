'use client'

import React from 'react'

interface TicketActionButtonsSectionProps {
  isEditing: boolean
  isDraft: boolean
  isSubmitting: boolean
  isDraftSubmitting: boolean
  isPublishSubmitting: boolean
  title: string
  statusId: string
  canControlFlowRuntime: boolean
  isFlowingNow: boolean
  isFlowActionPending: boolean
  isCompletingFlow: boolean
  onDelete?: () => void
  onSwitchToView?: () => void
  onSaveAndView?: () => void
  onCancel: () => void
  onSubmit: (creationStatus: 'draft' | 'active', switchToView?: boolean) => void
  onStartFlow: () => void
  onStopFlow: () => void
  onEndFlow: () => void
}

export function TicketActionButtonsSection({
  isEditing,
  isDraft,
  isSubmitting,
  isDraftSubmitting,
  isPublishSubmitting,
  title,
  statusId,
  canControlFlowRuntime,
  isFlowingNow,
  isFlowActionPending,
  isCompletingFlow,
  onDelete,
  onSwitchToView,
  onSaveAndView,
  onCancel,
  onSubmit,
  onStartFlow,
  onStopFlow,
  onEndFlow,
}: TicketActionButtonsSectionProps) {
  return (
    <div
      className="flex items-center justify-end gap-3 border-t pt-4"
      style={{ borderColor: `rgb(var(--border-color))` }}
    >
      {(!isEditing || isDraft) && (
        <>
          {isDraft && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={isSubmitting}
            >
              Delete Draft
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ color: `rgb(var(--text-secondary))` }}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSubmit('draft')}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{
              backgroundColor: `rgb(var(--border-color))`,
              color: `rgb(var(--text-primary))`,
            }}
            disabled={
              isDraftSubmitting ||
              isPublishSubmitting ||
              !title.trim() ||
              !statusId
            }
          >
            {isDraftSubmitting
              ? 'Saving...'
              : isDraft
                ? 'Save Draft'
                : 'Save as Draft'}
          </button>

          <button
            type="button"
            onClick={() => onSubmit('active')}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{
              backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
              color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
            }}
            disabled={
              isDraftSubmitting ||
              isPublishSubmitting ||
              !title.trim() ||
              !statusId
            }
          >
            {isPublishSubmitting ? 'Publishing...' : 'Publish'}
          </button>
        </>
      )}

      {isEditing && !isDraft && (
        <>
          {canControlFlowRuntime && (
            <button
              type="button"
              onClick={isFlowingNow ? onStopFlow : onStartFlow}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{
                backgroundColor: isFlowingNow
                  ? 'rgb(239, 68, 68)'
                  : 'rgb(16, 185, 129)',
              }}
              disabled={isSubmitting || isFlowActionPending}
            >
              {isFlowActionPending
                ? isFlowingNow
                  ? 'Stopping...'
                  : 'Starting...'
                : isFlowingNow
                  ? 'Stop Flow'
                  : 'Start Flow'}
            </button>
          )}

          {canControlFlowRuntime && (
            <button
              type="button"
              onClick={onEndFlow}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'rgb(37, 99, 235)' }}
              disabled={isSubmitting || isFlowActionPending || isCompletingFlow}
            >
              {isCompletingFlow ? 'Ending...' : 'End Flow'}
            </button>
          )}

          {onSwitchToView && (
            <button
              type="button"
              onClick={onSwitchToView}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              disabled={isSubmitting}
            >
              Switch to View
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={isSubmitting}
            >
              Delete
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ color: `rgb(var(--text-secondary))` }}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          {onSaveAndView && (
            <button
              type="button"
              onClick={() => onSubmit('active', true)}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={isSubmitting || !title.trim() || !statusId}
            >
              {isSubmitting ? 'Saving...' : 'Save & View'}
            </button>
          )}

          <button
            type="button"
            onClick={() => onSubmit('active')}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{
              backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
              color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
            }}
            disabled={isSubmitting || !title.trim() || !statusId}
          >
            {isSubmitting
              ? 'Saving...'
              : onSaveAndView
                ? 'Save & Close'
                : 'Save Changes'}
          </button>
        </>
      )}
    </div>
  )
}
