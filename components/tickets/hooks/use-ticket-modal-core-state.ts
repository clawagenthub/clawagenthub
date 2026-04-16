import { useRef, useState } from 'react'
import type { ComposerAttachment } from '@/components/ui/text-area-with-image'
import type { TicketFlowMode } from '@/lib/db/schema'
import type { FlowConfig } from '../ticket-modal-flow-utils'
import type { TicketModalInitialData } from '../ticket-modal.types'

export function useTicketModalCoreState(initialData?: TicketModalInitialData) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [descriptionAttachments, setDescriptionAttachments] = useState<
    ComposerAttachment[]
  >([])
  const [statusId, setStatusId] = useState(initialData?.status_id || '')
  const [assignedTo, setAssignedTo] = useState(initialData?.assigned_to || '')
  const [flowEnabled, setFlowEnabled] = useState(
    initialData?.flow_enabled ?? false
  )
  const [flowMode, setFlowMode] = useState<TicketFlowMode>(
    initialData?.flow_mode ?? 'manual'
  )
  const [flowConfigs, setFlowConfigs] = useState<FlowConfig[]>([])
  const [isSubTicket, setIsSubTicket] = useState(
    initialData?.isSubTicket ?? false
  )
  const [parentTicketId, setParentTicketId] = useState(
    initialData?.parentTicketId || ''
  )
  const [waitingFinishedTicketId, setWaitingFinishedTicketId] = useState(
    initialData?.waitingFinishedTicketId || ''
  )
  const [projectId, setProjectId] = useState<string>(
    initialData?.project_id || ''
  )

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false)
  const [draftTicketId, setDraftTicketId] = useState<string | null>(null)
  const [hasCreatedDraft, setHasCreatedDraft] = useState(false)

  const [isLoadDefaultsConfirmOpen, setIsLoadDefaultsConfirmOpen] =
    useState(false)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [isAutoPromptLoading, setIsAutoPromptLoading] = useState(false)
  const [isDraftSubmitting, setIsDraftSubmitting] = useState(false)
  const [isPublishSubmitting, setIsPublishSubmitting] = useState(false)
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false)
  const [maxImagesPerPost, setMaxImagesPerPost] = useState(5)
  const [allowPdfAttachments, setAllowPdfAttachments] = useState(true)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  return {
    title,
    setTitle,
    description,
    setDescription,
    descriptionAttachments,
    setDescriptionAttachments,
    statusId,
    setStatusId,
    assignedTo,
    setAssignedTo,
    flowEnabled,
    setFlowEnabled,
    flowMode,
    setFlowMode,
    flowConfigs,
    setFlowConfigs,
    isSubTicket,
    setIsSubTicket,
    parentTicketId,
    setParentTicketId,
    waitingFinishedTicketId,
    setWaitingFinishedTicketId,
    projectId,
    setProjectId,
    workspaceId,
    setWorkspaceId,
    hasLoadedDraft,
    setHasLoadedDraft,
    draftTicketId,
    setDraftTicketId,
    hasCreatedDraft,
    setHasCreatedDraft,
    isLoadDefaultsConfirmOpen,
    setIsLoadDefaultsConfirmOpen,
    isPromptModalOpen,
    setIsPromptModalOpen,
    isAutoPromptLoading,
    setIsAutoPromptLoading,
    isDraftSubmitting,
    setIsDraftSubmitting,
    isPublishSubmitting,
    setIsPublishSubmitting,
    showDescriptionPreview,
    setShowDescriptionPreview,
    maxImagesPerPost,
    setMaxImagesPerPost,
    allowPdfAttachments,
    setAllowPdfAttachments,
    saveTimeoutRef,
  }
}
