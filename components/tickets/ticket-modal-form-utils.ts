import { useMemo } from 'react'
import type { TicketCreationStatus, TicketFlowMode } from '@/lib/db/schema'
import type { FlowConfig } from './ticket-modal-flow-utils'

export interface TicketFormState {
  title: string
  description: string
  statusId: string
  assignedTo: string
  flowEnabled: boolean
  flowMode: TicketFlowMode
  flowConfigs: FlowConfig[]
  isSubTicket: boolean
  parentTicketId: string
  waitingFinishedTicketId: string
}

export interface TicketFormHandlers {
  setTitle: (value: string) => void
  setDescription: (value: string) => void
  setStatusId: (value: string) => void
  setAssignedTo: (value: string) => void
  setFlowEnabled: (value: boolean) => void
  setFlowMode: (value: TicketFlowMode) => void
  setFlowConfigs: (value: FlowConfig[]) => void
  setIsSubTicket: (value: boolean) => void
  setParentTicketId: (value: string) => void
  setWaitingFinishedTicketId: (value: string) => void
}

// Initial form state from initialData
export function getInitialFormState(initialData?: {
  title?: string
  description?: string
  status_id?: string
  assigned_to?: string
  flow_enabled?: boolean
  flow_mode?: TicketFlowMode
  creation_status?: TicketCreationStatus
  isSubTicket?: boolean
  parentTicketId?: string
}): Partial<TicketFormState> {
  return {
    title: initialData?.title || '',
    description: initialData?.description || '',
    statusId: initialData?.status_id || '',
    assignedTo: initialData?.assigned_to || '',
    flowEnabled: initialData?.flow_enabled ?? false,
    flowMode: initialData?.flow_mode ?? 'manual',
    isSubTicket: initialData?.isSubTicket ?? false,
    parentTicketId: initialData?.parentTicketId || '',
  }
}

// Status select options
export function useStatusOptions(statuses: { id: string; name: string }[] | undefined) {
  return useMemo(() => {
    return statuses?.map(s => ({ value: s.id, label: s.name })) || []
  }, [statuses])
}

// Assignee select options
export function useAssigneeOptions(
  workspaceMembers: { user_id: string; email: string; role?: string }[] | undefined
) {
  return useMemo(() => {
    const options = [{ value: '', label: 'Unassigned' }]
    const members = workspaceMembers?.map(m => ({
      value: m.user_id,
      label: `${m.email}${m.role === 'owner' ? ' (Owner)' : ''}`,
    })) || []
    return [...options, ...members]
  }, [workspaceMembers])
}

// Wait for ticket options
export function useWaitForTicketOptions(
  allTickets: { id: string; ticket_number: number; title: string; creation_status: string }[] | undefined,
  editingTicketId: string | null
) {
  return useMemo(() => {
    if (!allTickets) return []

    return [
      { value: '', label: 'Select a ticket to wait for...', disabled: true },
      ...allTickets
        .filter(t =>
          t.id !== editingTicketId &&
          t.creation_status === 'active'
        )
        .map(t => ({
          value: t.id,
          label: `#${t.ticket_number} - ${t.title}`,
        })),
    ]
  }, [allTickets, editingTicketId])
}

// Flow mode options
export const FLOW_MODE_OPTIONS = [
  { value: 'manual', label: 'Manual (stop after each status)' },
  { value: 'automatic', label: 'Automatic (continue through flow)' },
]

// Form validation
export function validateTicketForm(state: TicketFormState): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!state.title.trim()) {
    errors.push('Title is required')
  }

  if (!state.statusId) {
    errors.push('Status is required')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Check if form has content
export function hasFormContent(state: TicketFormState): boolean {
  return !!(state.title.trim() || state.description.trim() || state.statusId)
}

// Submit ticket data builder
export interface SubmitTicketData {
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
  flow_configs?: FlowConfig[]
}

export function buildSubmitTicketData(
  state: TicketFormState,
  options: {
    submitTicketId?: string
    isEditing: boolean
    draftTicketId?: string | null
    workspaceId?: string | null
  }
): SubmitTicketData {
  const { submitTicketId, isEditing, draftTicketId } = options

  const submitId = isEditing
    ? submitTicketId
    : draftTicketId

  return {
    id: submitId || undefined,
    title: state.title.trim(),
    description: state.description.trim() || undefined,
    status_id: state.statusId,
    assigned_to: state.assignedTo || undefined,
    flow_enabled: state.flowEnabled,
    flow_mode: state.flowMode,
    creation_status: 'active',
    isSubTicket: state.isSubTicket,
    parentTicketId: state.isSubTicket ? state.parentTicketId : undefined,
    waitingFinishedTicketId: state.waitingFinishedTicketId || undefined,
    flow_configs: state.flowEnabled ? state.flowConfigs : undefined,
  }
}
