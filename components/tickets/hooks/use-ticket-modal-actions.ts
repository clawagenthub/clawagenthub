import { useCallback } from 'react'
import {
  buildDefaultFlowConfigs,
  getGatewayAuthErrorMessage,
  isGatewayAuthError,
  type FlowConfig,
} from '../ticket-modal-flow-utils'
import type { ComposerAttachment } from '@/components/ui/text-area-with-image'
import type { TicketSubmitPayload } from '../ticket-modal.types'
import logger, { logCategories } from '@/lib/logger/index.js'

interface Params {
  state: any
  queries: any
  onSubmit: (data: TicketSubmitPayload, switchToView?: boolean) => unknown
  onClose: () => void
  initialData?: { id?: string; title?: string; creation_status?: string }
}

function createCancelHandler(state: any, onClose: () => void) {
  return () => {
    state.setTitle('')
    state.setDescription('')
    state.setDescriptionAttachments([])
    state.setStatusId('')
    state.setAssignedTo('')
    state.setProjectId('')
    state.setFlowEnabled(false)
    state.setFlowMode('manual')
    state.setFlowConfigs([])
    state.setIsSubTicket(false)
    state.setParentTicketId('')
    state.setWaitingFinishedTicketId('')
    state.setDraftTicketId(null)
    state.setHasCreatedDraft(false)
    state.setHasLoadedDraft(false)
    state.setIsLoadDefaultsConfirmOpen(false)
    state.setIsPromptModalOpen(false)
    state.setIsAutoPromptLoading(false)
    state.setIsDraftSubmitting(false)
    state.setIsPublishSubmitting(false)
    onClose()
  }
}

function resolveSubmittedTicketId(result: unknown, fallback?: string | null) {
  if (result && typeof result === 'object' && 'id' in result) {
    return (result as { id?: string }).id || fallback || undefined
  }
  return fallback || undefined
}

export function useTicketModalActions({
  state,
  queries,
  onSubmit,
  onClose,
  initialData,
}: Params) {
  const {
    title,
    description,
    descriptionAttachments,
    setDescriptionAttachments,
    statusId,
    assignedTo,
    flowEnabled,
    flowMode,
    flowConfigs,
    setFlowConfigs,
    isSubTicket,
    parentTicketId,
    waitingFinishedTicketId,
    projectId,
    setDescription,
    setStatusId,
    setHasLoadedDraft,
    draftTicketId,
    setDraftTicketId,
    setHasCreatedDraft,
    setIsLoadDefaultsConfirmOpen,
    isDraftSubmitting,
    setIsDraftSubmitting,
    isPublishSubmitting,
    setIsPublishSubmitting,
  } = state

  const {
    statuses,
    editingTicketId,
    flowRuntimeStatus,
    startFlow,
    stopFlow,
    completeFlow,
    isStartingFlow,
    isStoppingFlow,
    isCompletingFlow,
  } = queries

  const isEditing = !!initialData?.title
  const isDraft = initialData?.creation_status === 'draft'
  const canLoadDefaultConfig = flowEnabled && !!statuses?.length
  const canControlFlowRuntime = !!editingTicketId && !isDraft && flowEnabled
  const isFlowingNow = flowRuntimeStatus?.flowing_status === 'flowing'
  const isFlowActionPending = isStartingFlow || isStoppingFlow
  const modalTitle = isDraft
    ? '📝 Edit Draft Ticket'
    : isEditing
      ? 'Edit Ticket'
      : 'Create New Ticket'

  const persistDescriptionAttachments = useCallback(
    async (ticketId: string, attachments: ComposerAttachment[]) => {
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
      if (typeof data?.description === 'string')
        setDescription(data.description)
      setDescriptionAttachments([])
    },
    [setDescription, setDescriptionAttachments]
  )

  const handleLoadDefaultConfig = useCallback(() => {
    const initialConfigs = buildDefaultFlowConfigs(statuses)
    logger.debug(
      { category: logCategories.CHAT },
      '[[TicketModal] load default config]: count=%s',
      initialConfigs.length
    )
    setFlowConfigs(initialConfigs)
    if (!statusId && statuses && statuses.length > 0)
      setStatusId(statuses[0].id)
    setIsLoadDefaultsConfirmOpen(false)
  }, [
    statuses,
    statusId,
    setFlowConfigs,
    setStatusId,
    setIsLoadDefaultsConfirmOpen,
  ])

  const handleFlowConfigsChange = useCallback(
    (configs: FlowConfig[]) => setFlowConfigs(configs),
    [setFlowConfigs]
  )

  const handleStartFlow = useCallback(async () => {
    if (!editingTicketId || isFlowActionPending) return
    try {
      await startFlow({ ticketId: editingTicketId })
    } catch (error) {
      if (isGatewayAuthError(error)) alert(getGatewayAuthErrorMessage(error))
      else
        alert(error instanceof Error ? error.message : 'Failed to start flow')
    }
  }, [editingTicketId, isFlowActionPending, startFlow])

  const handleStopFlow = useCallback(async () => {
    if (!editingTicketId || isFlowActionPending) return
    try {
      await stopFlow({ ticketId: editingTicketId })
    } catch (error) {
      if (isGatewayAuthError(error)) alert(getGatewayAuthErrorMessage(error))
      else alert(error instanceof Error ? error.message : 'Failed to stop flow')
    }
  }, [editingTicketId, isFlowActionPending, stopFlow])

  const handleEndFlow = useCallback(async () => {
    if (!editingTicketId || isFlowActionPending || isCompletingFlow) return

    const confirmed = window.confirm(
      'Are you sure you want to end flow for this ticket? This will mark it as completed/finished.'
    )
    if (!confirmed) return

    try {
      await completeFlow({ ticketId: editingTicketId, finished: true })
    } catch (error) {
      if (isGatewayAuthError(error)) alert(getGatewayAuthErrorMessage(error))
      else alert(error instanceof Error ? error.message : 'Failed to end flow')
    }
  }, [editingTicketId, isFlowActionPending, isCompletingFlow, completeFlow])

  const handleSubmit = useCallback(
    async (creationStatus: 'draft' | 'active', switchToView?: boolean) => {
      if (!title.trim() || !statusId) return
      creationStatus === 'draft'
        ? setIsDraftSubmitting(true)
        : setIsPublishSubmitting(true)
      const submitTicketId = isEditing ? initialData?.id : draftTicketId

      try {
        const payload: TicketSubmitPayload = {
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
          project_id: projectId || undefined,
          flow_configs:
            flowEnabled && flowConfigs.length > 0 ? flowConfigs : undefined,
        }

        const result = await Promise.resolve(onSubmit(payload, switchToView))
        const resolvedTicketId = resolveSubmittedTicketId(
          result,
          submitTicketId
        )

        if (resolvedTicketId && descriptionAttachments.length > 0) {
          await persistDescriptionAttachments(
            resolvedTicketId,
            descriptionAttachments
          )
        }

        setHasLoadedDraft(false)
        setDraftTicketId(null)
        setHasCreatedDraft(false)
      } finally {
        creationStatus === 'draft'
          ? setIsDraftSubmitting(false)
          : setIsPublishSubmitting(false)
      }
    },
    [
      title,
      statusId,
      isEditing,
      initialData,
      draftTicketId,
      description,
      assignedTo,
      flowEnabled,
      flowMode,
      isSubTicket,
      parentTicketId,
      waitingFinishedTicketId,
      projectId,
      flowConfigs,
      onSubmit,
      descriptionAttachments,
      persistDescriptionAttachments,
      setHasLoadedDraft,
      setDraftTicketId,
      setHasCreatedDraft,
      setIsDraftSubmitting,
      setIsPublishSubmitting,
    ]
  )

  const handleCancel = () => createCancelHandler(state, onClose)()

  return {
    isEditing,
    isDraft,
    canLoadDefaultConfig,
    canControlFlowRuntime,
    isFlowingNow,
    isFlowActionPending,
    isCompletingFlow,
    modalTitle,
    isDraftSubmitting,
    isPublishSubmitting,
    handleSubmit,
    handleCancel,
    handleLoadDefaultConfig,
    handleFlowConfigsChange,
    handleStartFlow,
    handleStopFlow,
    handleEndFlow,
  }
}
