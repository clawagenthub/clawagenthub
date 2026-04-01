'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { MarkdownEditor } from './markdown-editor'
import { StatusFlowBuilder } from './status-flow-builder'
import {
  useStatuses,
  useWorkspaceMembers,
  useGatewayAgents,
  useCreateTicket,
  useUpdateTicket,
  useTicketFlowConfig,
  useTicketFlowStatus,
  useStartTicketFlow,
  useStopTicketFlow,
} from '@/lib/query/hooks'
import type { TicketCreationStatus, TicketFlowMode } from '@/lib/db/schema'

interface TicketModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    id?: string
    title: string
    description?: string
    status_id: string
    assigned_to?: string
    flow_enabled?: boolean
    flow_mode?: TicketFlowMode
    creation_status?: TicketCreationStatus
    flow_configs?: Array<{
      status_id: string
      flow_order: number
      agent_id?: string | null
      on_failed_goto?: string | null
      ask_approve_to_continue?: boolean
      instructions_override?: string
      is_included?: boolean
    }>
  }) => void
  initialData?: {
    id?: string
    title?: string
    description?: string
    status_id?: string
    assigned_to?: string
    flow_enabled?: boolean
    flow_mode?: TicketFlowMode
    creation_status?: TicketCreationStatus
  }
  isSubmitting?: boolean
  onSwitchToView?: () => void
  onDelete?: () => void
  // Deprecated - use hooks internally instead
  availableUsers?: Array<{ id: string; email: string }>
  availableAgents?: Array<{ id: string; name: string }>
}

// Local storage key for draft auto-save
const DRAFT_STORAGE_KEY = 'ticket-draft'

// Get workspace-specific storage key
function getStorageKey(workspaceId: string | null) {
  return workspaceId ? `${DRAFT_STORAGE_KEY}-${workspaceId}` : DRAFT_STORAGE_KEY
}

// Load draft from localStorage
function loadDraftFromStorage(workspaceId: string | null) {
  if (typeof window === 'undefined') return null
  try {
    const key = getStorageKey(workspaceId)
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

// Save draft to localStorage
function saveDraftToStorage(workspaceId: string | null, data: any) {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(workspaceId)
    localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch {
    // Ignore storage errors
  }
}

// Clear draft from localStorage
function clearDraftFromStorage(workspaceId: string | null) {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(workspaceId)
    localStorage.removeItem(key)
  } catch {
    // Ignore storage errors
  }
}

export function TicketModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
  onSwitchToView,
  onDelete,
  availableUsers = [],
  availableAgents = [],
}: TicketModalProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [statusId, setStatusId] = useState(initialData?.status_id || '')
  const [assignedTo, setAssignedTo] = useState(initialData?.assigned_to || '')
  const [flowEnabled, setFlowEnabled] = useState(initialData?.flow_enabled ?? false)
  const [flowMode, setFlowMode] = useState<TicketFlowMode>(initialData?.flow_mode ?? 'manual')
  const [flowConfigs, setFlowConfigs] = useState<Array<{
    status_id: string
    flow_order: number
    agent_id?: string | null
    on_failed_goto?: string | null
    ask_approve_to_continue?: boolean
    instructions_override?: string
    is_included?: boolean
  }>>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false)
  const [draftTicketId, setDraftTicketId] = useState<string | null>(null)
  const [hasCreatedDraft, setHasCreatedDraft] = useState(false)
  const [isLoadDefaultsConfirmOpen, setIsLoadDefaultsConfirmOpen] = useState(false)

  // Debounced save timeout ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const { data: statuses } = useStatuses()
  const { data: workspaceMembers } = useWorkspaceMembers()
  const { data: gatewayAgents } = useGatewayAgents()
  const editingTicketId = initialData?.id && initialData?.title ? initialData.id : null
  const { data: existingFlowConfigs } = useTicketFlowConfig(editingTicketId)
  const { data: flowRuntimeStatus } = useTicketFlowStatus(editingTicketId)
  const { mutateAsync: startFlow, isPending: isStartingFlow } = useStartTicketFlow()
  const { mutateAsync: stopFlow, isPending: isStoppingFlow } = useStopTicketFlow()

  useEffect(() => {
    if (!editingTicketId) return
    console.log('[TicketModal] existingFlowConfigs query update', {
      ticketId: editingTicketId,
      hasData: !!existingFlowConfigs,
      count: existingFlowConfigs?.length ?? 0,
    })
  }, [editingTicketId, existingFlowConfigs])
  
  // Import hooks for draft auto-save
  const { mutateAsync: createTicket } = useCreateTicket()
  const { mutateAsync: updateTicket } = useUpdateTicket()

  // Get workspace ID from session (read from localStorage)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sessionData = localStorage.getItem('session_data')
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData)
          setWorkspaceId(parsed.currentWorkspaceId || null)
        } catch {
          setWorkspaceId(null)
        }
      }
    }
  }, [])

  // Load draft from localStorage on modal open (if no initialData)
  useEffect(() => {
    if (isOpen && !initialData?.title && !hasLoadedDraft && workspaceId) {
      const draft = loadDraftFromStorage(workspaceId)
      if (draft) {
        setTitle(draft.title || '')
        setDescription(draft.description || '')
        setStatusId(draft.statusId || '')
        setAssignedTo(draft.assignedTo || '')
        setFlowEnabled(draft.flowEnabled ?? false)
        setFlowMode((draft.flowMode as TicketFlowMode) ?? 'manual')
        setFlowConfigs(draft.flowConfigs || [])
        setHasLoadedDraft(true)
        // Load draft ticket ID if exists
        if (draft.ticketId) {
          setDraftTicketId(draft.ticketId)
          setHasCreatedDraft(true)
        }
      }
    }
  }, [isOpen, initialData, workspaceId, hasLoadedDraft])

  // For edit mode, hydrate flow configs from ticket API so saved draft/active flow is visible.
  useEffect(() => {
    if (!isOpen || !editingTicketId) return

    // Avoid wiping UI state while query is still loading/refreshing.
    if (existingFlowConfigs === undefined) {
      console.log('[TicketModal] Skipping hydration - flow config query still loading', {
        ticketId: editingTicketId,
      })
      return
    }

    const statusIdByName = new Map((statuses || []).map((s) => [s.name, s.id]))
    const mappedConfigs = existingFlowConfigs
      .map((config) => {
        const fromId = config.status?.id ?? config.status_id
        const fromName = config.status?.name
        const resolvedStatusId = fromId || (fromName ? statusIdByName.get(fromName) : undefined)

        if (!resolvedStatusId) {
          return null
        }

        return {
          status_id: resolvedStatusId,
          flow_order: config.flow_order,
          agent_id: config.agent_id ?? undefined,
          on_failed_goto: config.on_failed_goto ?? undefined,
          ask_approve_to_continue: config.ask_approve_to_continue,
          instructions_override: config.instructions_override ?? undefined,
          is_included: config.is_included,
        }
      })
      .filter((config): config is NonNullable<typeof config> => config !== null)

    console.log('[TicketModal] Hydrating flow configs for edit mode', {
      ticketId: editingTicketId,
      count: mappedConfigs.length,
      flowEnabled,
    })

    setFlowConfigs(mappedConfigs)
  }, [isOpen, editingTicketId, existingFlowConfigs, flowEnabled, statuses])

  // Auto-save draft to database on input changes
  useEffect(() => {
    if (!isOpen) return

    // Don't auto-save if editing existing ticket (not a new draft)
    const isEditing = !!initialData?.title
    if (isEditing) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Save after 500ms of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      // Only save if there's title or description content (not just selecting status/assignee)
      const hasContent = title.trim() || description.trim()
      if (!hasContent) return

      try {
        if (draftTicketId) {
          // Update existing draft
          await updateTicket({
            id: draftTicketId,
            title: title.trim() || 'Draft',
            description: description.trim() || undefined,
            status_id: statusId || undefined,
            assigned_to: assignedTo || undefined,
            flow_enabled: flowEnabled,
            flow_mode: flowMode,
          })
        } else {
          // Create new draft ticket
          const newTicket = await createTicket({
            title: title.trim() || 'Draft',
            description: description.trim() || undefined,
            status_id: statusId || (statuses?.[0]?.id ?? ''),
            assigned_to: assignedTo || undefined,
            flow_enabled: flowEnabled,
            flow_mode: flowMode,
            creation_status: 'draft',
          })
          setDraftTicketId(newTicket.id)
          setHasCreatedDraft(true)
          // Save draft ID to localStorage for persistence
          saveDraftToStorage(workspaceId, {
            title,
            description,
            statusId,
            assignedTo,
            flowEnabled,
            flowMode,
            flowConfigs,
            ticketId: newTicket.id,
          })
        }
      } catch (error) {
        console.error('Failed to auto-save draft:', error)
      }
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [title, description, statusId, assignedTo, flowEnabled, flowMode, draftTicketId, isOpen, workspaceId, initialData, createTicket, updateTicket, statuses])

  const buildDefaultFlowConfigs = useCallback(() => {
    if (!statuses || statuses.length === 0) {
      return []
    }

    const includedStatuses = statuses.filter(s => s.is_flow_included)

    return includedStatuses.map((status, index) => ({
      status_id: status.id,
      flow_order: index,
      is_included: true,
      agent_id: status.agent_id ?? undefined,
      on_failed_goto: status.on_failed_goto ?? undefined,
      ask_approve_to_continue: status.ask_approve_to_continue,
      instructions_override: status.instructions_override ?? undefined,
    }))
  }, [statuses])

  const handleLoadDefaultConfig = useCallback(() => {
    const initialConfigs = buildDefaultFlowConfigs()

    console.log('[TicketModal] Loading flow configs from status defaults by user action', {
      includedCount: initialConfigs.length,
      totalStatuses: statuses?.length ?? 0,
      source: 'manual-load-default-config',
    })

    setFlowConfigs(initialConfigs)

    console.log('[TicketModal] Applied default flow configs to modal state', {
      appliedCount: initialConfigs.length,
      statusIds: initialConfigs.map(config => config.status_id),
    })

    if (!statusId && statuses && statuses.length > 0) {
      setStatusId(statuses[0].id)
    }

    setIsLoadDefaultsConfirmOpen(false)
  }, [buildDefaultFlowConfigs, statusId, statuses])

  const handleFlowConfigsChange = useCallback((configs: Array<{
    status_id: string
    flow_order: number
    agent_id?: string | null
    on_failed_goto?: string | null
    ask_approve_to_continue?: boolean
    instructions_override?: string
    is_included?: boolean
  }>) => {
    console.log('[TicketModal] onChange from StatusFlowBuilder', {
      nextCount: configs.length,
      statusIds: configs.map(config => config.status_id),
    })
    setFlowConfigs(configs)
  }, [])

  useEffect(() => {
    const isEditingCurrent = !!initialData?.title
    const isDraftCurrent = initialData?.creation_status === 'draft'

    console.log('[TicketModal] flowConfigs state changed', {
      flowEnabled,
      count: flowConfigs.length,
      statusIds: flowConfigs.map(config => config.status_id),
      isDraft: isDraftCurrent,
      isEditing: isEditingCurrent,
    })
  }, [flowConfigs, flowEnabled, initialData?.title, initialData?.creation_status])

  // Clear draft when it's empty on close
  useEffect(() => {
    if (!isOpen) {
      // Only clear if form is empty (wasn't submitted)
      if (!title && !description && !statusId) {
        clearDraftFromStorage(workspaceId)
      }
    }
  }, [isOpen, title, description, statusId, workspaceId])

  const handleSubmit = useCallback((creationStatus: TicketCreationStatus) => {
    if (!title.trim()) return
    if (!statusId) return

    const isEditingExistingTicket = !!initialData?.title
    const submitTicketId = isEditingExistingTicket
      ? initialData?.id
      : draftTicketId

    onSubmit({
      id: submitTicketId || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      status_id: statusId,
      assigned_to: assignedTo || undefined,
      flow_enabled: flowEnabled,
      flow_mode: flowMode,
      creation_status: creationStatus,
      flow_configs: flowEnabled ? flowConfigs : undefined,
    })

    console.log('[TicketModal] Submitting ticket with flow config payload', {
      creationStatus,
      submitTicketId: submitTicketId || null,
      flowEnabled,
      flowConfigCount: flowEnabled ? flowConfigs.length : 0,
      flowConfigStatusIds: flowEnabled ? flowConfigs.map(config => config.status_id) : [],
    })

    // Clear draft after successful submission
    clearDraftFromStorage(workspaceId)
    setHasLoadedDraft(false)
    setDraftTicketId(null)
    setHasCreatedDraft(false)
  }, [title, description, statusId, assignedTo, flowEnabled, flowMode, flowConfigs, onSubmit, workspaceId, initialData?.title, initialData?.id, draftTicketId])

  const handleReset = () => {
    setTitle(initialData?.title || '')
    setDescription(initialData?.description || '')
    setStatusId(initialData?.status_id || '')
    setAssignedTo(initialData?.assigned_to || '')
    setFlowEnabled(initialData?.flow_enabled ?? false)
    setFlowMode(initialData?.flow_mode ?? 'manual')
    const statusIdByName = new Map((statuses || []).map((s) => [s.name, s.id]))
    setFlowConfigs(
      (existingFlowConfigs || [])
        .map((config) => {
          const fromId = config.status?.id ?? config.status_id
          const fromName = config.status?.name
          const resolvedStatusId = fromId || (fromName ? statusIdByName.get(fromName) : undefined)

          if (!resolvedStatusId) {
            return null
          }

          return {
            status_id: resolvedStatusId,
            flow_order: config.flow_order,
            agent_id: config.agent_id ?? undefined,
            on_failed_goto: config.on_failed_goto ?? undefined,
            ask_approve_to_continue: config.ask_approve_to_continue,
            instructions_override: config.instructions_override ?? undefined,
            is_included: config.is_included,
          }
        })
        .filter((config): config is NonNullable<typeof config> => config !== null)
    )
    setHasLoadedDraft(false)
    setDraftTicketId(null)
    setHasCreatedDraft(false)
  }

  const handleCancel = () => {
    // DO NOT delete draft - drafts should persist for later
    // Just close the modal
    // Clear draft ID from state (will be reloaded from localStorage on next open)
    setDraftTicketId(null)
    setHasCreatedDraft(false)
    setHasLoadedDraft(false)
    setIsLoadDefaultsConfirmOpen(false)
    onClose()
  }

  // Prepare select options
  const statusOptions = statuses?.map(s => ({ value: s.id, label: s.name })) || []
  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...(workspaceMembers?.map(m => ({
      value: m.user_id,
      label: `${m.email}${m.role === 'owner' ? ' (Owner)' : ''}`
    })) || [])
  ]

  const isEditing = !!initialData?.title
  const isDraft = initialData?.creation_status === 'draft'
  const canLoadDefaultConfig = flowEnabled && !!statuses?.length
  const canControlFlowRuntime = !!editingTicketId && !isDraft && flowEnabled
  const isFlowingNow = flowRuntimeStatus?.flowing_status === 'flowing'
  const isFlowActionPending = isStartingFlow || isStoppingFlow

  const handleStartFlow = useCallback(async () => {
    if (!editingTicketId || isFlowActionPending) return
    try {
      await startFlow({ ticketId: editingTicketId })
    } catch (error) {
      console.error('Failed to start flow runtime:', error)
    }
  }, [editingTicketId, isFlowActionPending, startFlow])

  const handleStopFlow = useCallback(async () => {
    if (!editingTicketId || isFlowActionPending) return
    try {
      await stopFlow({ ticketId: editingTicketId })
    } catch (error) {
      console.error('Failed to stop flow runtime:', error)
    }
  }, [editingTicketId, isFlowActionPending, stopFlow])

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        title={
          isDraft
            ? '📝 Edit Draft Ticket'
            : isEditing
              ? 'Edit Ticket'
              : 'Create New Ticket'
        }
        dismissible={!isSubmitting}
        size="xl"
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit('active'); }}>
        {/* Title */}
        <div>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter ticket title..."
            maxLength={200}
            disabled={isSubmitting}
            required
          />
          <p className="text-xs mt-1" style={{ color: `rgb(var(--text-tertiary))` }}>
            {title.length}/200 characters
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: `rgb(var(--text-secondary))` }}>
            Description
          </label>
          <MarkdownEditor
            value={description}
            onChange={setDescription}
            placeholder="Describe the ticket in Markdown..."
            height={200}
            readOnly={isSubmitting}
          />
        </div>

        {/* Status Selection */}
        <Select
          label="Status"
          options={statusOptions}
          value={statusId}
          onChange={(e) => setStatusId(e.target.value)}
          placeholder="Select status..."
          disabled={isSubmitting}
          required
        />

        {/* Assignee */}
        <Select
          label="Assignee"
          options={assigneeOptions}
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          disabled={isSubmitting}
        />

        {/* Flow Toggle */}
        <div
          className="flex items-center justify-between p-3 rounded-lg border"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderColor: `rgb(var(--border-color))`
          }}
        >
          <div>
            <span className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
              Enable Flow
            </span>
            <p className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>
              Enable automatic flow progression
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={flowEnabled}
                onChange={(e) => {
                  const checked = e.target.checked
                  console.log('[TicketModal] Flow toggle changed', {
                    checked,
                    mode: isDraft ? 'draft' : 'active',
                    ticketType: isEditing ? 'edit' : 'create',
                  })
                  setFlowEnabled(checked)
                }}
                className="sr-only peer"
                disabled={isSubmitting}
              />
            <div
              className="w-11 h-6 rounded-full transition-colors"
              style={{
                backgroundColor: flowEnabled ? `rgb(var(--accent-primary, 59 130 246))` : `rgb(var(--border-color))`,
              }}
            >
              <div
                className="absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform"
                style={{
                  transform: flowEnabled ? 'translateX(20px)' : 'translateX(0)',
                }}
              ></div>
            </div>
          </label>
        </div>

          {/* Flow Configuration */}
          {flowEnabled && statuses && (
            <div 
              className="border-t pt-4"
              style={{ borderColor: `rgb(var(--border-color))` }}
            >
              <Select
                label="Flow Mode"
                options={[
                  { value: 'manual', label: 'Manual (stop after each status)' },
                  { value: 'automatic', label: 'Automatic (continue through flow)' },
                ]}
                value={flowMode}
                onChange={(e) => setFlowMode(e.target.value as TicketFlowMode)}
                disabled={isSubmitting}
              />
              <p className="text-xs mt-1 mb-3" style={{ color: `rgb(var(--text-secondary))` }}>
                Manual mode is recommended by default. Automatic mode advances to next status without waiting.
              </p>

              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 
                  className="text-sm font-medium"
                  style={{ color: `rgb(var(--text-primary))` }}
                >
                  Flow Configuration
                </h3>
                {canLoadDefaultConfig && (
                  <button
                    type="button"
                    onClick={() => setIsLoadDefaultsConfirmOpen(true)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: `rgb(var(--bg-secondary))`,
                      color: `rgb(var(--text-primary))`,
                      border: '1px solid rgb(var(--border-color))',
                    }}
                    disabled={isSubmitting}
                  >
                    Load Default Config
                  </button>
                )}
              </div>
              <p 
                className="text-xs mb-3"
                style={{ color: `rgb(var(--text-secondary))` }}
              >
                Drag and drop to reorder. Click to expand options. Customize agent, failure handling, and approval requirements per status.
              </p>
              <StatusFlowBuilder
                statuses={statuses}
                initialConfigs={flowConfigs}
                availableAgents={gatewayAgents?.map(agent => ({
                  id: agent.agentId,
                  name: `${agent.agentName} (${agent.gatewayName})`,
                }))}
                onChange={handleFlowConfigsChange}
                disabled={isSubmitting}
              />
            </div>
          )}

        {/* Actions */}
        <div 
          className="flex items-center justify-end gap-3 pt-4 border-t"
          style={{ borderColor: `rgb(var(--border-color))` }}
        >
          {canControlFlowRuntime && (
            <button
              type="button"
              onClick={isFlowingNow ? handleStopFlow : handleStartFlow}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isFlowingNow
                  ? 'rgb(239, 68, 68)'
                  : 'rgb(16, 185, 129)',
                color: 'white',
              }}
              disabled={isSubmitting || isFlowActionPending}
            >
              {isFlowActionPending
                ? (isFlowingNow ? 'Stopping...' : 'Starting...')
                : (isFlowingNow ? 'Stop Flow' : 'Start Flow')}
            </button>
          )}

          {isEditing && !isDraft && onSwitchToView && (
            <button
              type="button"
              onClick={onSwitchToView}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: `rgb(var(--bg-secondary))`,
                color: `rgb(var(--text-primary))`,
                border: '1px solid rgb(var(--border-color))',
              }}
              disabled={isSubmitting}
            >
              Switch to View
            </button>
          )}

          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: `rgb(var(--text-secondary))` }}
            disabled={isSubmitting}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = `rgb(var(--text-primary))`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = `rgb(var(--text-secondary))`
            }}
          >
            Cancel
          </button>
          
          {/* Show dual buttons for new tickets or drafts */}
          {!isEditing || isDraft ? (
            <>
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: `rgb(var(--border-color))`,
                  color: `rgb(var(--text-primary))`,
                }}
                disabled={isSubmitting || !title.trim() || !statusId}
              >
                {isSubmitting ? 'Saving...' : isDraft ? 'Save Draft' : 'Save as Draft'}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('active')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
                  color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
                }}
                disabled={isSubmitting || !title.trim() || !statusId}
              >
                {isSubmitting ? 'Publishing...' : isDraft ? 'Publish' : 'Publish'}
              </button>
            </>
          ) : (
            <>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'rgb(239, 68, 68)',
                    color: 'white',
                  }}
                  disabled={isSubmitting}
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSubmit('active')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
                  color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
                }}
                disabled={isSubmitting || !title.trim() || !statusId}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
        </form>
      </Modal>

      <Modal
        isOpen={isLoadDefaultsConfirmOpen}
        onClose={() => setIsLoadDefaultsConfirmOpen(false)}
        title="Load Default Flow Config"
        dismissible={!isSubmitting}
      >
        <div className="space-y-4">
          <p style={{ color: `rgb(var(--text-secondary))` }}>
            Are you sure you want to load default flow config from statuses? This will overwrite the current flow configuration.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsLoadDefaultsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-md px-4 py-2 font-medium transition-colors"
              style={{
                backgroundColor: `rgb(var(--bg-secondary))`,
                color: `rgb(var(--text-primary))`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLoadDefaultConfig}
              disabled={isSubmitting}
              className="rounded-md px-4 py-2 font-medium transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
                color: `rgb(var(--accent-primary-foreground, 255 255 255))`,
              }}
            >
              Yes, Load Defaults
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
