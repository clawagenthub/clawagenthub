import { useEffect } from 'react'
import {
  clearDraftFromStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
} from '../ticket-modal-draft-storage'
import { mapExternalFlowConfig } from '../ticket-modal-flow-utils'
import type { TicketFlowMode } from '@/lib/db/schema'
import logger from '@/lib/logger/index.js'

interface EffectsParams {
  isOpen: boolean
  initialData?: { title?: string }
  state: any
  queries: any
}

export function useTicketModalEffects({
  isOpen,
  initialData,
  state,
  queries,
}: EffectsParams) {
  const {
    title,
    description,
    statusId,
    assignedTo,
    flowEnabled,
    flowMode,
    flowConfigs,
    draftTicketId,
    workspaceId,
    hasLoadedDraft,
    saveTimeoutRef,
    setWorkspaceId,
    setMaxImagesPerPost,
    setAllowPdfAttachments,
    setTitle,
    setDescription,
    setDescriptionAttachments,
    setStatusId,
    setAssignedTo,
    setFlowEnabled,
    setFlowMode,
    setFlowConfigs,
    setProjectId,
    setIsSubTicket,
    setParentTicketId,
    setWaitingFinishedTicketId,
    setDraftTicketId,
    setHasCreatedDraft,
    setHasLoadedDraft,
    setIsLoadDefaultsConfirmOpen,
    setIsPromptModalOpen,
    setIsAutoPromptLoading,
  } = state
  const {
    statuses,
    existingFlowConfigs,
    editingTicketId,
    createTicket,
    updateTicket,
  } = queries

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sessionData = localStorage.getItem('session_data')
    if (!sessionData) return
    try {
      const parsed = JSON.parse(sessionData)
      setWorkspaceId(parsed.currentWorkspaceId || null)
    } catch {
      setWorkspaceId(null)
    }
  }, [setWorkspaceId])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/workspaces/settings')
        if (!response.ok) return
        const data = await response.json()
        if (cancelled) return
        const parsed = Number.parseInt(data.max_images_per_post || '', 10)
        setMaxImagesPerPost(Number.isFinite(parsed) && parsed > 0 ? parsed : 5)
        setAllowPdfAttachments(
          data.allow_pdf_attachments
            ? data.allow_pdf_attachments === 'true'
            : true
        )
      } catch (error) {
        logger.error('[TicketModal] settings load failed', error)
      }
    }
    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [isOpen, setAllowPdfAttachments, setMaxImagesPerPost])

  useEffect(() => {
    if (!isOpen || initialData?.title || hasLoadedDraft || !workspaceId) return
    const draft = loadDraftFromStorage(workspaceId)
    if (!draft) return
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
  }, [
    isOpen,
    initialData,
    hasLoadedDraft,
    workspaceId,
    setTitle,
    setDescription,
    setStatusId,
    setAssignedTo,
    setFlowEnabled,
    setFlowMode,
    setFlowConfigs,
    setHasLoadedDraft,
    setDraftTicketId,
    setHasCreatedDraft,
  ])

  useEffect(() => {
    if (!isOpen || !editingTicketId || existingFlowConfigs === undefined) return
    const statusIdByName = new Map<string, string>(
      (statuses || []).map((s: any) => [String(s.name), String(s.id)])
    )
    const mapped = (existingFlowConfigs || [])
      .map((config: any) =>
        mapExternalFlowConfig(
          {
            ...config,
            instructions_override: config.instructions_override ?? undefined,
          },
          statusIdByName
        )
      )
      .filter((config: any) => config !== null)
    setFlowConfigs(mapped)
  }, [isOpen, editingTicketId, existingFlowConfigs, statuses, setFlowConfigs])

  useEffect(() => {
    if (!isOpen || initialData?.title || hasLoadedDraft) return
    setTitle('')
    setDescription('')
    setDescriptionAttachments([])
    setStatusId('')
    setAssignedTo('')
    setProjectId('')
    setFlowEnabled(false)
    setFlowMode('manual')
    setFlowConfigs([])
    setIsSubTicket(false)
    setParentTicketId('')
    setWaitingFinishedTicketId('')
    setDraftTicketId(null)
    setHasCreatedDraft(false)
    setIsLoadDefaultsConfirmOpen(false)
    setIsPromptModalOpen(false)
    setIsAutoPromptLoading(false)
  }, [
    isOpen,
    initialData,
    hasLoadedDraft,
    setTitle,
    setDescription,
    setDescriptionAttachments,
    setStatusId,
    setAssignedTo,
    setProjectId,
    setFlowEnabled,
    setFlowMode,
    setFlowConfigs,
    setIsSubTicket,
    setParentTicketId,
    setWaitingFinishedTicketId,
    setDraftTicketId,
    setHasCreatedDraft,
    setIsLoadDefaultsConfirmOpen,
    setIsPromptModalOpen,
    setIsAutoPromptLoading,
  ])

  useEffect(() => {
    if (!isOpen || initialData?.title) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
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
          return
        }
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
      } catch (error) {
        logger.error('auto-save draft failed', error)
      }
    }, 500)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [
    isOpen,
    initialData,
    title,
    description,
    statusId,
    assignedTo,
    flowEnabled,
    flowMode,
    flowConfigs,
    draftTicketId,
    workspaceId,
    statuses,
    createTicket,
    updateTicket,
    setDraftTicketId,
    setHasCreatedDraft,
    saveTimeoutRef,
  ])

  useEffect(() => {
    if (isOpen) return
    if (!title && !description && !statusId) {
      clearDraftFromStorage(workspaceId)
    }
  }, [isOpen, title, description, statusId, workspaceId])
}
