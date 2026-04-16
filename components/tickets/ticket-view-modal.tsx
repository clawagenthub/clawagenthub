'use client'
/* eslint-disable max-lines, max-lines-per-function */

import React, { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import {
  useTicket,
  useTicketComments,
  useAddTicketComment,
  useTicketFlowStatus,
  useStartTicketFlow,
  useStopTicketFlow,
  useCompleteTicketFlow,
  useDeleteTicket,
} from '@/lib/query/hooks'
import { AuditLogPanel } from './audit-log-panel'
import { marked } from 'marked'
import logger from '@/lib/logger/index.js'

// ============================================================================
// Sub-components
// ============================================================================

function FlowFailureAlert({ reason }: { reason: string }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgb(239, 68, 68)',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg text-red-500">⚠️</span>
        <div>
          <p className="text-sm font-medium text-red-600">Flow Failed</p>
          <p className="mt-1 text-xs text-red-500">{reason}</p>
        </div>
      </div>
    </div>
  )
}

function SubTicketParentNav({ onViewParent }: { onViewParent: () => void }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: 'rgb(var(--border-color))',
        backgroundColor: 'rgb(var(--bg-secondary))',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-sm"
          style={{ color: `rgb(var(--text-secondary))` }}
        >
          Sub-ticket of:
        </span>
        <button
          type="button"
          onClick={onViewParent}
          className="cursor-pointer text-sm font-medium underline"
          style={{ color: `rgb(var(--accent-primary, 59 130 246))` }}
        >
          View Parent Ticket →
        </button>
      </div>
    </div>
  )
}

interface TicketHeaderActionsProps {
  isStopFlowAvailable: boolean
  isCompletingFlow: boolean
  isFlowActionPending: boolean
  canControlFlowRuntime: boolean
  canDelete: boolean
  isDeletingTicket: boolean
  onStartFlow: () => void
  onStopFlow: () => void
  onEndFlow: () => void
  onDelete: () => void
  onSwitchToEdit: () => void
}

function TicketHeaderActions({
  isStopFlowAvailable,
  isCompletingFlow,
  isFlowActionPending,
  canControlFlowRuntime,
  canDelete,
  isDeletingTicket,
  onStartFlow,
  onStopFlow,
  onEndFlow,
  onDelete,
  onSwitchToEdit,
}: TicketHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {canControlFlowRuntime && (
        <button
          type="button"
          onClick={isStopFlowAvailable ? onStopFlow : onStartFlow}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: isStopFlowAvailable
              ? 'rgb(239, 68, 68)'
              : 'rgb(16, 185, 129)',
            color: 'white',
          }}
          disabled={isFlowActionPending}
        >
          {isFlowActionPending
            ? isStopFlowAvailable
              ? 'Stopping...'
              : 'Starting...'
            : isStopFlowAvailable
              ? 'Stop Flow'
              : 'Start Flow'}
        </button>
      )}

      {canControlFlowRuntime && (
        <button
          type="button"
          onClick={onEndFlow}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: 'rgb(37, 99, 235)',
            color: 'white',
          }}
          disabled={isFlowActionPending || isCompletingFlow}
        >
          {isCompletingFlow ? 'Ending...' : 'End Flow'}
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeletingTicket}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: 'rgb(220, 38, 38)',
            color: 'white',
          }}
          title="Delete this ticket"
        >
          {isDeletingTicket ? 'Deleting...' : '🗑 Delete'}
        </button>
      )}
      <button
        type="button"
        onClick={onSwitchToEdit}
        className="rounded-md px-3 py-1.5 text-xs font-medium"
        style={{
          backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
          color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
        }}
      >
        Switch to Edit
      </button>
    </div>
  )
}

interface CollapsibleDescriptionProps {
  description: string
  isExpanded: boolean
  onToggle: () => void
}

function CollapsibleDescription({
  description,
  isExpanded,
  onToggle,
}: CollapsibleDescriptionProps) {
  return (
    <div
      className="rounded-lg border"
      style={{
        borderColor: `rgb(var(--border-color))`,
        backgroundColor: `rgb(var(--bg-secondary))`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span
          className="text-sm font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Task Description
        </span>
        <svg
          className="h-4 w-4 transition-transform"
          style={{
            color: `rgb(var(--text-secondary))`,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isExpanded && (
        <div
          className="whitespace-pre-wrap break-words px-3 pb-3 pt-0 text-sm"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          {description}
        </div>
      )}
    </div>
  )
}

interface CommentItemProps {
  comment: {
    id: string
    content: string
    created_at: string
    updated_at: string
    created_by: { email: string }
    is_agent_completion_signal?: boolean
  }
}

function CommentItem({ comment }: CommentItemProps) {
  const [showMarkdown, setShowMarkdown] = useState(false)
  const edited = comment.updated_at !== comment.created_at

  const contentHtml = useMemo(() => {
    if (!showMarkdown) return null
    try {
      return marked(comment.content)
    } catch {
      return '<p class="text-red-500">Invalid markdown</p>'
    }
  }, [comment.content, showMarkdown])

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: `rgb(var(--border-color))`,
        backgroundColor: `rgb(var(--bg-secondary))`,
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="truncate text-xs font-medium"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            {comment.created_by.email}
          </span>
          {comment.is_agent_completion_signal && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: 'rgb(79, 70, 229)',
              }}
            >
              AGENT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMarkdown(!showMarkdown)}
            className="rounded px-2 py-0.5 text-[10px] transition-colors"
            style={{
              backgroundColor: showMarkdown
                ? 'rgb(var(--accent-primary, 59 130 246))'
                : 'rgb(var(--bg-primary))',
              color: showMarkdown ? 'white' : 'rgb(var(--text-secondary))',
              border: '1px solid rgb(var(--border-color))',
            }}
            title={showMarkdown ? 'Show raw' : 'Show markdown'}
          >
            {showMarkdown ? 'Raw' : 'MD'}
          </button>
          <span
            className="text-[10px]"
            style={{ color: `rgb(var(--text-tertiary))` }}
          >
            {new Date(comment.created_at).toLocaleString()}
          </span>
        </div>
      </div>
      {showMarkdown ? (
        <div
          className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-sm"
          style={{ color: `rgb(var(--text-primary))` }}
          dangerouslySetInnerHTML={{ __html: contentHtml || '' }}
        />
      ) : (
        <p
          className="whitespace-pre-wrap break-words text-sm"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          {comment.content}
        </p>
      )}
      {edited && (
        <p
          className="mt-1 text-[10px]"
          style={{ color: `rgb(var(--text-tertiary))` }}
        >
          edited {new Date(comment.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}

interface CommentInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  showPreview?: boolean
  onTogglePreview?: () => void
}

function CommentInput({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  showPreview,
  onTogglePreview,
}: CommentInputProps) {
  return (
    <div className="space-y-2">
      {onTogglePreview && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onTogglePreview}
            className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: showPreview
                ? 'rgb(var(--accent-primary, 59 130 246))'
                : 'rgb(var(--bg-secondary))',
              color: showPreview ? 'white' : 'rgb(var(--text-primary))',
              border: '1px solid rgb(var(--border-color))',
            }}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{
          borderColor: `rgb(var(--border-color))`,
          backgroundColor: `rgb(var(--bg-primary))`,
          color: `rgb(var(--text-primary))`,
        }}
        placeholder="Add a comment..."
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !value.trim()}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
          style={{
            backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
            color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
          }}
        >
          {isSubmitting ? 'Posting...' : 'Add Comment'}
        </button>
      </div>
    </div>
  )
}

interface TimelineItem {
  id: string
  type: 'comment' | 'audit'
  created_at: string
  payload: Record<string, unknown>
}

interface CombinedTimelineProps {
  timeline: TimelineItem[]
}

function CombinedTimeline({ timeline }: CombinedTimelineProps) {
  return (
    <div className="max-h-[250px] space-y-2 overflow-auto pr-1">
      {timeline.length === 0 ? (
        <p className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>
          No timeline items yet.
        </p>
      ) : (
        timeline.map((item) => (
          <div
            key={item.id}
            className="text-xs"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            <span style={{ color: `rgb(var(--text-tertiary))` }}>
              {new Date(item.created_at).toLocaleString()}:
            </span>{' '}
            {item.type === 'comment'
              ? `Comment by ${(item.payload as { created_by?: { email?: string } }).created_by?.email}`
              : `Activity: ${(item.payload as { event_type?: string }).event_type}`}
          </div>
        ))
      )}
    </div>
  )
}

interface TicketViewModalProps {
  isOpen: boolean
  ticketId: string | null
  onClose: () => void
  onSwitchToEdit: () => void
  onViewParent?: (parentTicketId: string) => void
}

export function TicketViewModal({
  isOpen,
  ticketId,
  onClose,
  onSwitchToEdit,
  onViewParent,
}: TicketViewModalProps) {
  const { data: ticket, isLoading: isTicketLoading } = useTicket(ticketId)
  const { data: comments = [], isLoading: isCommentsLoading } =
    useTicketComments(ticketId)
  const { mutateAsync: addComment, isPending: isAddingComment } =
    useAddTicketComment()
  const { data: flowRuntimeStatus } = useTicketFlowStatus(ticketId)
  const { mutateAsync: startFlow, isPending: isStartingFlow } =
    useStartTicketFlow()
  const { mutateAsync: stopFlow, isPending: isStoppingFlow } =
    useStopTicketFlow()
  const { mutateAsync: completeFlow, isPending: isCompletingFlow } =
    useCompleteTicketFlow()
  const { mutateAsync: deleteTicket, isPending: isDeletingTicket } =
    useDeleteTicket()
  const [commentInput, setCommentInput] = useState('')
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [showCommentPreview, setShowCommentPreview] = useState(false)

  const timeline = useMemo(() => {
    const commentEvents = comments.map((comment) => ({
      id: `comment-${comment.id}`,
      type: 'comment' as const,
      created_at: comment.created_at,
      payload: comment,
    }))

    const auditEvents = (ticket?.audit_logs || []).map((log) => ({
      id: `audit-${log.id}`,
      type: 'audit' as const,
      created_at: log.created_at,
      payload: log,
    }))

    return [...commentEvents, ...auditEvents].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [comments, ticket?.audit_logs])

  async function handleViewParent() {
    if (!ticket?.parent_ticket_id) return
    onViewParent?.(ticket.parent_ticket_id)
  }

  async function handleAddComment() {
    if (!ticketId || !commentInput.trim()) return
    await addComment({ ticketId, content: commentInput.trim() })
    setCommentInput('')
  }

  async function handleStartFlow() {
    if (!ticketId) return
    try {
      await startFlow({ ticketId })
    } catch (error) {
      logger.error('Failed to start flow:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to start flow'

      // Check if this is a gateway/auth error that might need gateway restart
      const isGatewayAuthError =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('503') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('auth') ||
        errorMessage.includes('Gateway') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('unreachable') ||
        errorMessage.includes('not reachable')

      if (isGatewayAuthError) {
        alert(
          `Gateway connection error: ${errorMessage}\n\nThe gateway may need to be restarted. Please go to Settings > Gateways and reconnect.`
        )
      } else {
        alert(errorMessage)
      }
    }
  }

  async function handleStopFlow() {
    if (!ticketId) return
    try {
      await stopFlow({ ticketId })
    } catch (error) {
      logger.error('Failed to stop flow:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to stop flow'

      // Check if this is a gateway/auth error that might need gateway restart
      const isGatewayAuthError =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('503') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('auth') ||
        errorMessage.includes('Gateway') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('unreachable') ||
        errorMessage.includes('not reachable')

      if (isGatewayAuthError) {
        alert(
          `Gateway connection error: ${errorMessage}\n\nThe gateway may need to be restarted. Please go to Settings > Gateways and reconnect.`
        )
      } else {
        alert(errorMessage)
      }
    }
  }

  async function handleDelete() {
    if (!ticketId || !ticket) return

    const confirmed = window.confirm(
      `Delete ticket #${ticket.ticket_number} "${ticket.title}"? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      await deleteTicket(ticketId)
      onClose()
    } catch (error) {
      logger.error('Failed to delete ticket:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete ticket')
    }
  }

  async function handleEndFlow() {
    if (!ticketId || !ticket) return

    const confirmed = window.confirm(
      `Are you sure you want to end flow for ticket #${ticket.ticket_number}? This will move it to completed/finished.`
    )
    if (!confirmed) return

    try {
      await completeFlow({ ticketId, finished: true })
    } catch (error) {
      logger.error('Failed to end flow:', error)
      alert(error instanceof Error ? error.message : 'Failed to end flow')
    }
  }

  const isFlowingNow = flowRuntimeStatus?.flowing_status === 'flowing'
  const isWaitingToFlowNow =
    flowRuntimeStatus?.flowing_status === 'waiting_to_flow'
  const isStopFlowAvailable = isFlowingNow || isWaitingToFlowNow
  const isFlowFailed = flowRuntimeStatus?.flowing_status === 'failed'
  const isFlowActionPending = isStartingFlow || isStoppingFlow
  const canControlFlowRuntime = Boolean(
    ticket?.flow_enabled && ticket?.creation_status === 'active'
  )

  // Allow deletion for all tickets (drafts and published from any status)
  const canDelete = true

  // Get the most recent flow failure reason from audit logs
  const latestFlowFailure = ticket?.audit_logs
    ?.filter((log) => log.event_type === 'flow_failed')
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

  const getFlowFailureReason = () => {
    if (!latestFlowFailure?.new_value) return 'Unknown error'
    try {
      const parsed = JSON.parse(latestFlowFailure.new_value)
      return parsed.reason || 'Unknown error'
    } catch {
      return latestFlowFailure.new_value || 'Unknown error'
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        ticket ? `Task #${ticket.ticket_number} · ${ticket.title}` : 'Task View'
      }
      dismissible={!isAddingComment}
      size="xl"
    >
      <div className="space-y-4">
        {/* Flow Failure Alert */}
        {isFlowFailed && <FlowFailureAlert reason={getFlowFailureReason()} />}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p
              className="text-xs"
              style={{ color: `rgb(var(--text-secondary))` }}
            >
              View mode
            </p>
            <p
              className="text-sm"
              style={{ color: `rgb(var(--text-primary))` }}
            >
              Track progress, comments, and activity timeline.
            </p>
          </div>
          <TicketHeaderActions
            isStopFlowAvailable={isStopFlowAvailable}
            isCompletingFlow={isCompletingFlow}
            isFlowActionPending={isFlowActionPending}
            canControlFlowRuntime={canControlFlowRuntime}
            canDelete={canDelete}
            isDeletingTicket={isDeletingTicket}
            onStartFlow={handleStartFlow}
            onStopFlow={handleStopFlow}
            onEndFlow={handleEndFlow}
            onDelete={handleDelete}
            onSwitchToEdit={onSwitchToEdit}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3
              className="text-sm font-medium"
              style={{ color: `rgb(var(--text-primary))` }}
            >
              Comments
            </h3>

            {/* Collapsible Task Description */}
            {ticket?.description && (
              <CollapsibleDescription
                description={ticket.description}
                isExpanded={isDescriptionExpanded}
                onToggle={() =>
                  setIsDescriptionExpanded(!isDescriptionExpanded)
                }
              />
            )}

            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {isCommentsLoading ? (
                <p
                  className="text-sm"
                  style={{ color: `rgb(var(--text-secondary))` }}
                >
                  Loading comments...
                </p>
              ) : comments.length === 0 ? (
                <p
                  className="text-sm"
                  style={{ color: `rgb(var(--text-secondary))` }}
                >
                  No comments yet.
                </p>
              ) : (
                comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} />
                ))
              )}
            </div>

            <CommentInput
              value={commentInput}
              onChange={setCommentInput}
              onSubmit={handleAddComment}
              isSubmitting={isAddingComment}
              showPreview={showCommentPreview}
              onTogglePreview={() => setShowCommentPreview(!showCommentPreview)}
            />
            {showCommentPreview && commentInput && (
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: 'rgb(var(--border-color))',
                  backgroundColor: 'rgb(var(--bg-secondary))',
                }}
              >
                <p
                  className="mb-2 text-xs font-medium"
                  style={{ color: 'rgb(var(--text-secondary))' }}
                >
                  Preview
                </p>
                <div
                  className="whitespace-pre-wrap break-words text-sm"
                  style={{ color: 'rgb(var(--text-primary))' }}
                  dangerouslySetInnerHTML={{ __html: marked(commentInput) }}
                />
              </div>
            )}
          </div>

          <div>
            {isTicketLoading ? (
              <p
                className="text-sm"
                style={{ color: `rgb(var(--text-secondary))` }}
              >
                Loading timeline...
              </p>
            ) : (
              <>
                <AuditLogPanel logs={ticket?.audit_logs || []} />
                <div
                  className="mt-4 rounded-lg border p-3"
                  style={{ borderColor: `rgb(var(--border-color))` }}
                >
                  <h4
                    className="mb-2 text-sm font-medium"
                    style={{ color: `rgb(var(--text-primary))` }}
                  >
                    Combined Timeline
                  </h4>
                  <CombinedTimeline timeline={timeline} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sub-Ticket Parent Navigation - Last in main content */}
        {ticket?.is_sub_ticket && ticket?.parent_ticket_id && (
          <SubTicketParentNav onViewParent={handleViewParent} />
        )}
      </div>
    </Modal>
  )
}
