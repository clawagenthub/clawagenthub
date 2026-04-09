'use client'

import React, { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { useTicket, useTicketComments, useAddTicketComment, useTicketFlowStatus, useStartTicketFlow, useStopTicketFlow, useDeleteTicket, useWorkspacePrompts, useUpdateTicket } from '@/lib/query/hooks'
import { AuditLogPanel } from './audit-log-panel'
import logger, { logCategories } from '@/lib/logger/index.js'


interface TicketViewModalProps {
  isOpen: boolean
  ticketId: string | null
  onClose: () => void
  onSwitchToEdit: () => void
  onViewParent?: (parentTicketId: string) => void
}

export function TicketViewModal({ isOpen, ticketId, onClose, onSwitchToEdit, onViewParent }: TicketViewModalProps) {
  const { data: ticket, isLoading: isTicketLoading } = useTicket(ticketId)
  const { data: comments = [], isLoading: isCommentsLoading } = useTicketComments(ticketId)
  const { mutateAsync: addComment, isPending: isAddingComment } = useAddTicketComment()
  const { mutateAsync: updateTicket } = useUpdateTicket()
  const { data: flowRuntimeStatus } = useTicketFlowStatus(ticketId)
  const { mutateAsync: startFlow, isPending: isStartingFlow } = useStartTicketFlow()
  const { mutateAsync: stopFlow, isPending: isStoppingFlow } = useStopTicketFlow()
  const { mutateAsync: deleteTicket, isPending: isDeletingTicket } = useDeleteTicket()
  const [commentInput, setCommentInput] = useState('')
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [isAutoFormatLoading, setIsAutoFormatLoading] = useState(false)
  const { data: workspacePrompts } = useWorkspacePrompts()

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

  async function handleViewParent() {
    if (!ticket?.parent_ticket_id) return
    onViewParent?.(ticket.parent_ticket_id)
  }

  async function handleAddComment() {
    if (!ticketId || !commentInput.trim()) return
    await addComment({ ticketId, content: commentInput.trim() })
    setCommentInput('')
  }

  async function handleAutoFormat() {
    if (!ticketId) return
    if (!ticket?.description?.trim()) {
      alert('No description text to format.')
      return
    }
    if (!workspacePrompts?.length) {
      alert('No prompts available. Add prompts in Settings → Default Prompts.')
      return
    }
    setIsAutoFormatLoading(true)
    try {
      const response = await fetch('/api/tickets/prompt-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          mode: 'auto',
          targetText: ticket.description,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to generate auto format')
      }

      const convertedText = data?.convertedText
      if (!convertedText || typeof convertedText !== 'string') {
        throw new Error('Prompt converter returned empty text')
      }

      await updateTicket({
        id: ticketId,
        description: convertedText,
      })
    } catch (error) {
      logger.error('Auto format error:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate auto format')
    } finally {
      setIsAutoFormatLoading(false)
    }
  }

  async function handleStartFlow() {
    if (!ticketId) return
    try {
      await startFlow({ ticketId })
    } catch (error) {
      logger.error('Failed to start flow:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start flow'
      
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
        alert(`Gateway connection error: ${errorMessage}\n\nThe gateway may need to be restarted. Please go to Settings > Gateways and reconnect.`)
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop flow'
      
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
        alert(`Gateway connection error: ${errorMessage}\n\nThe gateway may need to be restarted. Please go to Settings > Gateways and reconnect.`)
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

  const isFlowingNow = flowRuntimeStatus?.flowing_status === 'flowing'
  const isFlowFailed = flowRuntimeStatus?.flowing_status === 'failed'
  const isFlowActionPending = isStartingFlow || isStoppingFlow
  const canControlFlowRuntime = ticket?.flow_enabled && ticket?.creation_status === 'active'
  
  // Allow deletion for all tickets (drafts and published from any status)
  const canDelete = true

  // Get the most recent flow failure reason from audit logs
  const latestFlowFailure = ticket?.audit_logs
    ?.filter(log => log.event_type === 'flow_failed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

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
      title={ticket ? `Task #${ticket.ticket_number} · ${ticket.title}` : 'Task View'}
      dismissible={!isAddingComment}
      size="xl"
    >
      <div className="space-y-4">
        {/* Flow Failure Alert */}
        {isFlowFailed && (
          <div
            className="p-3 rounded-lg border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgb(239, 68, 68)',
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium text-red-600">
                  Flow Failed
                </p>
                <p className="text-xs text-red-500 mt-1">
                  {getFlowFailureReason()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sub-Ticket Parent Navigation */}
        {ticket?.is_sub_ticket && ticket?.parent_ticket_id && (
          <div
            className="p-3 rounded-lg border"
            style={{
              borderColor: 'rgb(var(--border-color))',
              backgroundColor: 'rgb(var(--bg-secondary))'
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
                Sub-ticket of:
              </span>
              <button
                type="button"
                onClick={handleViewParent}
                className="text-sm font-medium underline cursor-pointer"
                style={{ color: `rgb(var(--accent-primary, 59 130 246))` }}
              >
                View Parent Ticket →
              </button>
            </div>
          </div>
        )}

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

            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
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
              <div className="flex justify-end gap-2">
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
                  <div className="space-y-2 max-h-[250px] overflow-auto pr-1">
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

