'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { MarkdownEditor } from './markdown-editor'
import { TextAreaWithImage, type ComposerAttachment } from '@/components/ui/text-area-with-image'
import { StatusFlowBuilder } from './status-flow-builder'
import { SelectPromptModal } from '@/components/ui/select-prompt-modal'
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
  useWorkspacePrompts,
  useTickets,
} from '@/lib/query/hooks'
import { buildSelectedTicketConverterPrompt } from '@/lib/utils/prompts/selectedTicketConverterPrompt'
import type { TicketCreationStatus, TicketFlowMode } from '@/lib/db/schema'
import {
  loadDraftFromStorage,
  saveDraftToStorage,
  clearDraftFromStorage,
  getStorageKey,
} from './ticket-modal-draft-storage'
import type { FlowConfig } from './ticket-modal-flow-utils'
import { buildDefaultFlowConfigs, mapExternalFlowConfig, isGatewayAuthError, getGatewayAuthErrorMessage } from './ticket-modal-flow-utils'
import {
  useStatusOptions,
  useAssigneeOptions,
  useWaitForTicketOptions,
  getInitialFormState,
  FLOW_MODE_OPTIONS,
  buildSubmitTicketData,
} from './ticket-modal-form-utils'
import { buildAutoTicketConverterPrompt } from '@/lib/utils/prompts/autoTicketConverterPrompt'
import logger, { logCategories } from '@/lib/logger/index.js'


// ============================================================================
// Types
// ============================================================================

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
    isSubTicket?: boolean
    parentTicketId?: string
    waitingFinishedTicketId?: string
    flow_configs?: Array<{
      status_id: string
      flow_order: number
      agent_id?: string | null
      on_failed_goto?: string | null
      ask_approve_to_continue?: boolean
      instructions_override?: string
      is_included?: boolean
    }>
  }, switchToView?: boolean) => void
  initialData?: {
    id?: string
    title?: string
    description?: string
    status_id?: string
    assigned_to?: string
    flow_enabled?: boolean
    flow_mode?: TicketFlowMode
    creation_status?: TicketCreationStatus
    isSubTicket?: boolean
    parentTicketId?: string
  }
  isSubmitting?: boolean
  onSwitchToView?: () => void
  onSaveAndView?: () => void
  onDelete?: () => void
  availableUsers?: Array<{ id: string; email: string }>
  availableAgents?: Array<{ id: string; name: string }>
}

type DraftFormState = Pick<
  TicketModalProps['initialData'],
  'title' | 'description' | 'status_id' | 'assigned_to' | 'flow_enabled' | 'flow_mode'
>

// ============================================================================
// TicketModal Component
// ============================================================================

export function TicketModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
  onSwitchToView,
  onSaveAndView,
  onDelete,
}: TicketModalProps) {
  // -------------------------------------------------------------------------
  // Form State
  // -------------------------------------------------------------------------
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [descriptionAttachments, setDescriptionAttachments] = useState<ComposerAttachment[]>([])
  const [statusId, setStatusId] = useState(initialData?.status_id || '')
  const [assignedTo, setAssignedTo] = useState(initialData?.assigned_to || '')
  const [flowEnabled, setFlowEnabled] = useState(initialData?.flow_enabled ?? false)
  const [flowMode, setFlowMode] = useState<TicketFlowMode>(initialData?.flow_mode ?? 'manual')
  const [flowConfigs, setFlowConfigs] = useState<FlowConfig[]>([])
  const [isSubTicket, setIsSubTicket] = useState(initialData?.isSubTicket ?? false)
  const [parentTicketId, setParentTicketId] = useState(initialData?.parentTicketId || '')
  const [waitingFinishedTicketId, setWaitingFinishedTicketId] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false)
  const [draftTicketId, setDraftTicketId] = useState<string | null>(null)
  const [hasCreatedDraft, setHasCreatedDraft] = useState(false)
  const [isLoadDefaultsConfirmOpen, setIsLoadDefaultsConfirmOpen] = useState(false)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [isAutoPromptLoading, setIsAutoPromptLoading] = useState(false)
  const [maxImagesPerPost, setMaxImagesPerPost] = useState(5)
  const [allowPdfAttachments, setAllowPdfAttachments] = useState(true)

  // Debounced save timeout ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------
  const { data: statuses } = useStatuses()
  const { data: workspaceMembers } = useWorkspaceMembers()
  const { data: gatewayAgents } = useGatewayAgents()
  const editingTicketId = initialData?.id && initialData?.title ? initialData.id : null
  const { data: existingFlowConfigs } = useTicketFlowConfig(editingTicketId)
  const { data: flowRuntimeStatus } = useTicketFlowStatus(editingTicketId)
  const { mutateAsync: startFlow, isPending: isStartingFlow } = useStartTicketFlow()
  const { mutateAsync: stopFlow, isPending: isStoppingFlow } = useStopTicketFlow()
  const { data: workspacePrompts } = useWorkspacePrompts()
  const { data: allTickets } = useTickets()

  // -------------------------------------------------------------------------
  // Derived Options
  // -------------------------------------------------------------------------
  const statusOptions = useStatusOptions(statuses)
  const assigneeOptions = useAssigneeOptions(workspaceMembers)
  const waitForTicketOptions = useWaitForTicketOptions(allTickets, editingTicketId)

  // -------------------------------------------------------------------------
  // Derived Flags
  // -------------------------------------------------------------------------
  const isEditing = !!initialData?.title
  const isDraft = initialData?.creation_status === 'draft'
  const canLoadDefaultConfig = flowEnabled && !!statuses?.length
  const canControlFlowRuntime = !!editingTicketId && !isDraft && flowEnabled
  const isFlowingNow = flowRuntimeStatus?.flowing_status === 'flowing'
  const isFlowActionPending = isStartingFlow || isStoppingFlow

  // -------------------------------------------------------------------------
  // Workspace ID (from session)
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Load workspace attachment settings
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const loadWorkspaceAttachmentSettings = async () => {
      try {
        const response = await fetch('/api/workspaces/settings')
        if (!response.ok) return
        const data = await response.json()
        if (cancelled) return

        const parsedMaxImages = Number.parseInt(data.max_images_per_post || '', 10)
        setMaxImagesPerPost(Number.isFinite(parsedMaxImages) && parsedMaxImages > 0 ? parsedMaxImages : 5)
        setAllowPdfAttachments(data.allow_pdf_attachments ? data.allow_pdf_attachments === 'true' : true)
      } catch (error) {
        logger.error('[TicketModal] Failed to load workspace attachment settings:', error)
      }
    }

    void loadWorkspaceAttachmentSettings()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  // -------------------------------------------------------------------------
  // Load draft from localStorage on modal open (new ticket mode)
  // -------------------------------------------------------------------------
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
        if (draft.ticketId) {
          setDraftTicketId(draft.ticketId)
          setHasCreatedDraft(true)
        }
      }
    }
  }, [isOpen, initialData, workspaceId, hasLoadedDraft])

  // -------------------------------------------------------------------------
  // Hydrate flow configs from ticket API (edit mode)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !editingTicketId) return
    if (existingFlowConfigs === undefined) return

    const statusIdByName = new Map((statuses || []).map((s) => [s.name, s.id]))
    const mappedConfigs = existingFlowConfigs
      .map((config) => mapExternalFlowConfig(config, statusIdByName))
      .filter((config): config is FlowConfig => config !== null)

    logger.debug({ category: logCategories.CHAT }, '[[TicketModal] Hydrating flow configs for edit mode]: ticketId=%s count=%s', editingTicketId, mappedConfigs.length)

    setFlowConfigs(mappedConfigs)
  }, [isOpen, editingTicketId, existingFlowConfigs, flowEnabled, statuses])

  // -------------------------------------------------------------------------
  // Auto-save draft to database on input changes
  // -------------------------------------------------------------------------
  const { mutateAsync: createTicket } = useCreateTicket()
  const { mutateAsync: updateTicket } = useUpdateTicket()

  const persistDescriptionAttachments = useCallback(async (ticketId: string, attachments: ComposerAttachment[]) => {
    if (!attachments.length) return

    const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: attachments.map((attachment) => ({
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          kind: attachment.kind,
          dataBase64: attachment.dataBase64,
        })),
      }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw new Error(errorBody?.error || 'Failed to save attachments')
    }

    const data = await response.json()
    if (typeof data?.description === 'string') {
      setDescription(data.description)
    }
    setDescriptionAttachments([])
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const isEditing = !!initialData?.title
    if (isEditing) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const hasContent = title.trim() || description.trim()
      if (!hasContent) return

      try {
        if (draftTicketId) {
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
        logger.error('Failed to auto-save draft:', error)
      }
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [title, description, statusId, assignedTo, flowEnabled, flowMode, draftTicketId, isOpen, workspaceId, initialData, createTicket, updateTicket, statuses])

  // -------------------------------------------------------------------------
  // Clear draft when form is empty on modal close
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      if (!title && !description && !statusId) {
        clearDraftFromStorage(workspaceId)
      }
    }
  }, [isOpen, title, description, statusId, workspaceId])

  // -------------------------------------------------------------------------
  // Flow config change handler
  // -------------------------------------------------------------------------
  const handleFlowConfigsChange = useCallback((configs: FlowConfig[]) => {
    logger.debug({ category: logCategories.CHAT }, '[[TicketModal] onChange from StatusFlowBuilder]: nextCount=%s statusIds=%s', configs.length, configs.map(config => config.status_id))
    setFlowConfigs(configs)
  }, [])

  // -------------------------------------------------------------------------
  // Load default flow config
  // -------------------------------------------------------------------------
  const handleLoadDefaultConfig = useCallback(() => {
    const initialConfigs = buildDefaultFlowConfigs(statuses)
    logger.debug({ category: logCategories.CHAT }, '[[TicketModal] Loading flow configs from status defaults by user action]: includedCount=%s totalStatuses=%s', initialConfigs.length, statuses?.length ?? 0)
    setFlowConfigs(initialConfigs)
    if (!statusId && statuses && statuses.length > 0) {
      setStatusId(statuses[0].id)
    }
    setIsLoadDefaultsConfirmOpen(false)
  }, [statuses, statusId])

  // -------------------------------------------------------------------------
  // Flow runtime controls
  // -------------------------------------------------------------------------
  const handleStartFlow = useCallback(async () => {
    if (!editingTicketId || isFlowActionPending) return
    try {
      await startFlow({ ticketId: editingTicketId })
    } catch (error) {
      logger.error('Failed to start flow runtime:', error)
      if (isGatewayAuthError(error)) {
        alert(getGatewayAuthErrorMessage(error))
      } else {
        alert(error instanceof Error ? error.message : 'Failed to start flow')
      }
    }
  }, [editingTicketId, isFlowActionPending, startFlow])

  const handleStopFlow = useCallback(async () => {
    if (!editingTicketId || isFlowActionPending) return
    try {
      await stopFlow({ ticketId: editingTicketId })
    } catch (error) {
      logger.error('Failed to stop flow runtime:', error)
      if (isGatewayAuthError(error)) {
        alert(getGatewayAuthErrorMessage(error))
      } else {
        alert(error instanceof Error ? error.message : 'Failed to stop flow')
      }
    }
  }, [editingTicketId, isFlowActionPending, stopFlow])

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------
  const handleSubmit = useCallback(async (creationStatus: TicketCreationStatus, switchToView?: boolean) => {
    if (!title.trim()) return
    if (!statusId) return

    const isEditingExistingTicket = !!initialData?.title
    const submitTicketId = isEditingExistingTicket ? initialData?.id : draftTicketId

    const payload = {
      id: submitTicketId || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      status_id: statusId,
      assigned_to: assignedTo || undefined,
      flow_enabled: flowEnabled,
      flow_mode: flowMode,
      creation_status: creationStatus,
      isSubTicket,
      parentTicketId: isSubTicket ? parentTicketId : undefined,
      waitingFinishedTicketId: waitingFinishedTicketId || undefined,
      flow_configs: flowEnabled && flowConfigs.length > 0 ? flowConfigs : undefined,
    }

    const result = onSubmit(payload, switchToView)
    const maybeTicket = result instanceof Promise ? await result : null

    const resolvedTicketId = maybeTicket?.id || submitTicketId
    if (resolvedTicketId && descriptionAttachments.length > 0) {
      await persistDescriptionAttachments(resolvedTicketId, descriptionAttachments)
    }

    logger.debug({ category: logCategories.CHAT }, '[[TicketModal] Submitting ticket with flow config payload]: submitTicketId=%s flowConfigCount=%s attachmentCount=%s', resolvedTicketId || submitTicketId || null, flowEnabled ? flowConfigs.length : 0, descriptionAttachments.length)

    clearDraftFromStorage(workspaceId)
    setHasLoadedDraft(false)
    setDraftTicketId(null)
    setHasCreatedDraft(false)
  }, [title, description, statusId, assignedTo, flowEnabled, flowMode, flowConfigs, onSubmit, workspaceId, initialData, draftTicketId, isSubTicket, parentTicketId, waitingFinishedTicketId, descriptionAttachments, persistDescriptionAttachments])

  // -------------------------------------------------------------------------
  // Reset handler
  // -------------------------------------------------------------------------
  const handleReset = () => {
    const initial = getInitialFormState(initialData)
    setTitle(initial.title || '')
    setDescription(initial.description || '')
    setStatusId(initial.status_id || '')
    setAssignedTo(initial.assigned_to || '')
    setFlowEnabled(initial.flow_enabled ?? false)
    setFlowMode(initial.flow_mode ?? 'manual')

    const statusIdByName = new Map((statuses || []).map((s) => [s.name, s.id]))
    setFlowConfigs(
      (existingFlowConfigs || [])
        .map((config) => mapExternalFlowConfig(config, statusIdByName))
        .filter((config): config is FlowConfig => config !== null)
    )
    setHasLoadedDraft(false)
    setDraftTicketId(null)
    setHasCreatedDraft(false)
  }

  // -------------------------------------------------------------------------
  // Cancel handler
  // -------------------------------------------------------------------------
  const handleCancel = () => {
    setDraftTicketId(null)
    setHasCreatedDraft(false)
    setHasLoadedDraft(false)
    setIsLoadDefaultsConfirmOpen(false)
    onClose()
  }

  // -------------------------------------------------------------------------
  // Prompt modal handler
  // -------------------------------------------------------------------------
  const handlePromptSelect = useCallback((promptContent: string) => {
    const currentDescription = description.trim()
    const promptSection = `\n\n---\n${promptContent}\n`
    setDescription(currentDescription ? `${currentDescription}${promptSection}` : promptContent)
  }, [description])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const modalTitle = isDraft ? '📝 Edit Draft Ticket' : isEditing ? 'Edit Ticket' : 'Create New Ticket'

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        title={modalTitle}
        dismissible={!isSubmitting}
        size="xl"
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void handleSubmit('active'); }}>
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

          {/* Quick Add Prompt */}
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: `rgb(var(--text-secondary))` }}>
              Quick Add Prompt
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsPromptModalOpen(true)}
                disabled={isSubmitting || !workspacePrompts?.length}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  color: 'rgb(var(--text-primary))',
                  border: '1px solid rgb(var(--border-color))',
                }}
              >
                Load Prompt
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!description.trim()) {
                    alert('Please enter some text in the description first.')
                    return
                  }
                  if (!workspacePrompts?.length) {
                    alert('No prompts available. Add prompts in Settings → Default Prompts.')
                    return
                  }
                  setIsAutoPromptLoading(true)
                  try {
                    const response = await fetch('/api/tickets/prompt-convert', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ticketId: draftTicketId || initialData?.id,
                        mode: 'auto',
                        targetText: description,
                      }),
                    })

                    const data = await response.json().catch(() => null)
                    if (!response.ok) {
                      throw new Error(data?.message || 'Failed to generate auto prompt')
                    }

                    const convertedText = data?.convertedText
                    if (!convertedText || typeof convertedText !== 'string') {
                      throw new Error('Prompt converter returned empty text')
                    }

                    setDescription(convertedText)

                    const activeTicketId = draftTicketId || initialData?.id
                    if (activeTicketId) {
                      await updateTicket({
                        id: activeTicketId,
                        description: convertedText,
                      })
                    }
                  } catch (error) {
                    logger.error('Auto prompt error:', error)
                    alert(error instanceof Error ? error.message : 'Failed to generate auto prompt')
                  } finally {
                    setIsAutoPromptLoading(false)
                  }
                }}
                disabled={isSubmitting || !workspacePrompts?.length || isAutoPromptLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'rgb(var(--primary-color))',
                  color: 'white',
                }}
              >
                {isAutoPromptLoading ? 'Auto Prompt...' : 'Auto Prompt'}
              </button>
            </div>
            {workspacePrompts && workspacePrompts.length > 0 && (
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>
                {workspacePrompts.length} prompt{workspacePrompts.length !== 1 ? 's' : ''} available
              </p>
            )}
            {!workspacePrompts?.length && (
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>
                No prompts available. Add prompts in Settings → Default Prompts.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: `rgb(var(--text-secondary))` }}>
              Description
            </label>
            <div className="space-y-3">
              <TextAreaWithImage
                value={description}
                onChange={setDescription}
                attachments={descriptionAttachments}
                onAttachmentsChange={setDescriptionAttachments}
                placeholder="Describe the ticket in Markdown..."
                disabled={isSubmitting}
                minHeight={120}
                maxHeight={260}
                maxImages={maxImagesPerPost}
                maxFiles={maxImagesPerPost}
                allowPdf={allowPdfAttachments}
              />
              <MarkdownEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe the ticket in Markdown..."
                height={200}
                readOnly={isSubmitting}
              />
            </div>
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

          {/* Sub-Ticket Toggle */}
          <div
            className="flex items-center justify-between p-3 rounded-lg border"
            style={{
              backgroundColor: `rgb(var(--bg-secondary))`,
              borderColor: `rgb(var(--border-color))`
            }}
          >
            <div>
              <span className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>Sub-Ticket</span>
              <p className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>Mark as a sub-ticket of another ticket</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSubTicket}
                onChange={(e) => setIsSubTicket(e.target.checked)}
                className="sr-only peer"
                disabled={isSubmitting}
              />
              <div
                className="w-11 h-6 rounded-full transition-colors"
                style={{
                  backgroundColor: isSubTicket ? `rgb(var(--accent-primary, 59 130 246))` : `rgb(var(--border-color))`,
                }}
              >
                <div
                  className="absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform"
                  style={{ transform: isSubTicket ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </div>
            </label>
          </div>

          {/* Parent Ticket ID */}
          {isSubTicket && (
            <div>
              <Input
                label="Parent Ticket ID"
                value={parentTicketId}
                onChange={(e) => setParentTicketId(e.target.value)}
                placeholder="Paste parent ticket ID here..."
                disabled={isSubmitting}
              />
              <p className="text-xs mt-1" style={{ color: `rgb(var(--text-tertiary))` }}>
                Get the parent ticket ID from the URL when viewing the parent ticket
              </p>
            </div>
          )}

          {/* Wait for Ticket */}
          <Select
            label="Wait for Ticket (Optional)"
            options={waitForTicketOptions}
            value={waitingFinishedTicketId}
            onChange={(e) => setWaitingFinishedTicketId(e.target.value)}
            placeholder="Select a ticket to wait for..."
            disabled={isSubmitting}
          />
          <p className="text-xs mt-1" style={{ color: `rgb(var(--text-tertiary))` }}>
            This ticket will not start flowing until the selected ticket is finished
          </p>

          {/* Flow Toggle */}
          <div
            className="flex items-center justify-between p-3 rounded-lg border"
            style={{
              backgroundColor: `rgb(var(--bg-secondary))`,
              borderColor: `rgb(var(--border-color))`
            }}
          >
            <div>
              <span className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>Enable Flow</span>
              <p className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>Enable automatic flow progression</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={flowEnabled}
                onChange={(e) => {
                  logger.debug({ category: logCategories.CHAT }, '[[TicketModal] Flow toggle changed]: checked=%s mode=%s ticketType=%s', e.target.checked, isDraft ? 'draft' : 'active', isEditing ? 'edit' : 'create')
                  setFlowEnabled(e.target.checked)
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
                  style={{ transform: flowEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </div>
            </label>
          </div>

          {/* Flow Configuration Panel */}
          {flowEnabled && statuses && (
            <div className="border-t pt-4" style={{ borderColor: `rgb(var(--border-color))` }}>
              <Select
                label="Flow Mode"
                options={FLOW_MODE_OPTIONS}
                value={flowMode}
                onChange={(e) => setFlowMode(e.target.value as TicketFlowMode)}
                disabled={isSubmitting}
              />
              <p className="text-xs mt-1 mb-3" style={{ color: `rgb(var(--text-secondary))` }}>
                Manual mode is recommended by default. Automatic mode advances to next status without waiting.
              </p>

              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
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
              <p className="text-xs mb-3" style={{ color: `rgb(var(--text-secondary))` }}>
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

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: `rgb(var(--border-color))` }}>
            {canControlFlowRuntime && (
              <button
                type="button"
                onClick={isFlowingNow ? handleStopFlow : handleStartFlow}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isFlowingNow ? 'rgb(239, 68, 68)' : 'rgb(16, 185, 129)',
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
              onMouseEnter={(e) => { e.currentTarget.style.color = `rgb(var(--text-primary))` }}
              onMouseLeave={(e) => { e.currentTarget.style.color = `rgb(var(--text-secondary))` }}
            >
              Cancel
            </button>

            {/* New ticket / draft buttons */}
            {!isEditing || isDraft ? (
              <>
                {isDraft && onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:curor-not-allowed"
                    style={{ backgroundColor: 'rgb(239, 68, 68)', color: 'white' }}
                    disabled={isSubmitting}
                  >
                    Delete Draft
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { void handleSubmit('draft') }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `rgb(var(--border-color))`, color: `rgb(var(--text-primary))` }}
                  disabled={isSubmitting || !title.trim() || !statusId}
                >
                  {isSubmitting ? 'Saving...' : isDraft ? 'Save Draft' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSubmit('active') }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `rgb(var(--accent-primary, 59 130 246))`, color: `rgb(var(--accent-primary-foreground, 255 255 255))` }}
                  disabled={isSubmitting || !title.trim() || !statusId}
                >
                  {isSubmitting ? 'Publishing...' : 'Publish'}
                </button>
              </>
            ) : (
              /* Edit mode buttons */
              <>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'rgb(239, 68, 68)', color: 'white' }}
                    disabled={isSubmitting}
                  >
                    Delete
                  </button>
                )}
                {onSaveAndView && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleSubmit('active', true)
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: `rgb(var(--bg-secondary))`, color: `rgb(var(--text-primary))`, border: '1px solid rgb(var(--border-color))' }}
                    disabled={isSubmitting || !title.trim() || !statusId}
                  >
                    {isSubmitting ? 'Saving...' : 'Save & View'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { void handleSubmit('active') }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `rgb(var(--accent-primary, 59 130 246))`, color: `rgb(var(--accent-primary-foreground, 255 255 255))` }}
                  disabled={isSubmitting || !title.trim() || !statusId}
                >
                  {isSubmitting ? 'Saving...' : onSaveAndView ? 'Save & Close' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </form>
      </Modal>

      {/* Load Default Config Confirmation Modal */}
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
              style={{ backgroundColor: `rgb(var(--bg-secondary))`, color: `rgb(var(--text-primary))` }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLoadDefaultConfig}
              disabled={isSubmitting}
              className="rounded-md px-4 py-2 font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: `rgb(var(--accent-primary, 59 130 246))`, color: `rgb(var(--accent-primary-foreground, 255 255 255))` }}
            >
              Yes, Load Defaults
            </button>
          </div>
        </div>
      </Modal>

      {/* Prompt Selection Modal */}
      <SelectPromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        prompts={workspacePrompts || []}
        onSelect={handlePromptSelect}
      />
    </>
  )
}
