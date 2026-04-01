'use client'

import React, { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { useTicket, useTicketComments, useAddTicketComment, useTicketFlowStatus, useStartTicketFlow, useStopTicketFlow, useDeleteTicket } from '@/lib/query/hooks'
import { AuditLogPanel } from './audit-log-panel'

interface TicketViewModalProps {
  isOpen: boolean
  ticketId: string | null
  onClose: () => void
  onSwitchToEdit: () => void
}

export function TicketViewModal({ isOpen, ticketId, onClose, onSwitchToEdit }: TicketViewModalProps) {
  const { data: ticket, isLoading: isTicketLoading } = useTicket(ticketId)
  const { data: comments = [], isLoading: isCommentsLoading } = useTicketComments(ticketId)
  const { mutateAsync: addComment, isPending: isAddingComment } = useAddTicketComment()
  const { data: flowRuntimeStatus } = useTicketFlowStatus(ticketId)
  const { mutateAsync: startFlow, isPending: isStartingFlow } = useStartTicketFlow()
  const { mutateAsync: stopFlow, isPending: isStoppingFlow } = useStopTicketFlow()
  const { mutateAsync: deleteTicket, isPending: isDeletingTicket } = useDeleteTicket()
  const [commentInput, setCommentInput] = useState('')
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

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
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [comments, ticket?.audit_logs])

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
      console.error('Failed to start flow:', error)
      alert(error instanceof Error ? error.message : 'Failed to start flow')
    }
  }

  async function handleStopFlow() {
    if (!ticketId) return
    try {
      await stopFlow({ ticketId })
    } catch (error) {
      console.error('Failed to stop flow:', error)
      alert(error instanceof Error ? error.message : 'Failed to stop flow')
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
      console.error('Failed to delete ticket:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete ticket')
    }
  }

  const isFlowingNow = flowRuntimeStatus?.flowing_status === 'flowing'
  const isFlowActionPending = isStartingFlow || isStoppingFlow
  const canControlFlowRuntime = ticket?.flow_enabled && ticket?.creation_status === 'active'
  
  // Check if ticket status is "done" or "finished" (case-insensitive)
  const statusName = ticket?.status?.name?.toLowerCase() || ''
  const canDelete = statusName.includes('done') || statusName.includes('finished')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ticket ? `Task #${ticket.ticket_number} · ${ticket.title}` : 'Task View'}
      dismissible={!isAddingComment}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>
              View mode
            </p>
            <p className="text-sm" style={{ color: `rgb(var(--text-primary))` }}>
              Track progress, comments, and activity timeline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canControlFlowRuntime && (
              <button
                type="button"
                onClick={isFlowingNow ? handleStopFlow : handleStartFlow}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isFlowingNow
                    ? 'rgb(239, 68, 68)'
                    : 'rgb(16, 185, 129)',
                  color: 'white',
                }}
                disabled={isFlowActionPending}
              >
                {isFlowActionPending
                  ? (isFlowingNow ? 'Stopping...' : 'Starting...')
                  : (isFlowingNow ? 'Stop Flow' : 'Start Flow')}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeletingTicket}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="px-3 py-1.5 rounded-md text-xs font-medium"
              style={{
                backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
                color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
              }}
            >
              Switch to Edit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
              Comments
            </h3>

            {/* Collapsible Task Description */}
            {ticket?.description && (
              <div
                className="rounded-lg border"
                style={{
                  borderColor: `rgb(var(--border-color))`,
                  backgroundColor: `rgb(var(--bg-secondary))`
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <span className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
                    Task Description
                  </span>
                  <svg
                    className="w-4 h-4 transition-transform"
                    style={{
                      color: `rgb(var(--text-secondary))`,
                      transform: isDescriptionExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isDescriptionExpanded && (
                  <div
                    className="px-3 pb-3 pt-0 text-sm whitespace-pre-wrap break-words"
                    style={{ color: `rgb(var(--text-primary))` }}
                  >
                    {ticket.description}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {isCommentsLoading ? (
                <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>No comments yet.</p>
              ) : (
                comments.map((comment) => {
                  const edited = comment.updated_at !== comment.created_at
                  return (
                    <div
                      key={comment.id}
                      className="rounded-lg border p-3"
                      style={{ borderColor: `rgb(var(--border-color))`, backgroundColor: `rgb(var(--bg-secondary))` }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium truncate" style={{ color: `rgb(var(--text-primary))` }}>
                            {comment.created_by.email}
                          </span>
                          {comment.is_agent_completion_signal && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', color: 'rgb(79, 70, 229)' }}>
                              AGENT
                            </span>
                          )}
                        </div>
                        <span className="text-[10px]" style={{ color: `rgb(var(--text-tertiary))` }}>
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words" style={{ color: `rgb(var(--text-primary))` }}>
                        {comment.content}
                      </p>
                      {edited && (
                        <p className="text-[10px] mt-1" style={{ color: `rgb(var(--text-tertiary))` }}>
                          edited {new Date(comment.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="space-y-2">
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                rows={4}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={{
                  borderColor: `rgb(var(--border-color))`,
                  backgroundColor: `rgb(var(--bg-primary))`,
                  color: `rgb(var(--text-primary))`,
                }}
                placeholder="Add a comment..."
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={isAddingComment || !commentInput.trim()}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
                    color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
                  }}
                >
                  {isAddingComment ? 'Posting...' : 'Add Comment'}
                </button>
              </div>
            </div>
          </div>

          <div>
            {isTicketLoading ? (
              <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>Loading timeline...</p>
            ) : (
              <>
                <AuditLogPanel logs={ticket?.audit_logs || []} />
                <div className="mt-4 rounded-lg border p-3" style={{ borderColor: `rgb(var(--border-color))` }}>
                  <h4 className="text-sm font-medium mb-2" style={{ color: `rgb(var(--text-primary))` }}>
                    Combined Timeline
                  </h4>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {timeline.length === 0 ? (
                      <p className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>No timeline items yet.</p>
                    ) : (
                      timeline.map((item) => (
                        <div key={item.id} className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>
                          <span style={{ color: `rgb(var(--text-tertiary))` }}>{new Date(item.created_at).toLocaleString()}:</span>{' '}
                          {item.type === 'comment'
                            ? `Comment by ${item.payload.created_by.email}`
                            : `Activity: ${item.payload.event_type}`}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

