'use client'

import type { TicketCreationStatus, TicketFlowMode } from '@/lib/db/schema'

export interface TicketSubmitPayload {
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
  project_id?: string
  flow_configs?: Array<{
    status_id: string
    flow_order: number
    agent_id?: string | null
    on_failed_goto?: string | null
    ask_approve_to_continue?: boolean
    instructions_override?: string
    is_included?: boolean
  }>
}

export interface TicketModalInitialData {
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
  waitingFinishedTicketId?: string
  project_id?: string
}

export interface TicketModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    data: TicketSubmitPayload,
    switchToView?: boolean
  ) => void | Promise<{ id?: string } | void>
  initialData?: TicketModalInitialData
  isSubmitting?: boolean
  onSwitchToView?: () => void
  onSaveAndView?: () => void
  onDelete?: () => void
  availableUsers?: Array<{ id: string; email: string }>
  availableAgents?: Array<{ id: string; name: string }>
}
