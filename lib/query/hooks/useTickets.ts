import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TicketFlowConfig, TicketCreationStatus, TicketFlowingStatus, TicketFlowMode } from '@/lib/db/schema'

// Ticket types for API responses
export interface TicketWithRelations {
  id: string
  workspace_id: string
  ticket_number: number
  title: string
  description: string | null
  status_id: string
  created_by_id: string
  assigned_to_id: string | null
  flow_enabled: boolean
  flowing_status: TicketFlowingStatus
  flow_mode: TicketFlowMode
  current_agent_session_id: string | null
  last_flow_check_at: string | null
  completed_at: string | null
  creation_status: TicketCreationStatus
  created_at: string
  updated_at: string
  is_sub_ticket: boolean
  parent_ticket_id: string | null
  waiting_finished_ticket_id: string | null
  status: {
    id: string
    name: string
    color: string
  }
  created_by_user: {
    id: string
    email: string
    name: string
  }
  assigned_to_user: {
    id: string
    email: string
    name: string
  } | null
}

export interface TicketDetail extends TicketWithRelations {
  flow_configs: TicketFlowConfig[]
  audit_logs: Array<{
    id: string
    event_type: string
    actor: {
      id: string
      type: string
      email: string | null
    }
    old_value: string | null
    new_value: string | null
    metadata: string | null
    created_at: string
  }>
}

export interface TicketFlowConfigWithStatus extends TicketFlowConfig {
  status: {
    id: string
    name: string
    color: string
    default_agent_id?: string | null
    default_on_failed_goto?: string | null
    default_ask_approve_to_continue?: boolean
  }
}

export interface TicketFlowRuntimeStatus {
  flow_enabled: boolean
  flowing_status: TicketFlowingStatus
  current_status: {
    id: string
    name: string
    color: string
    agent_id: string | null
    on_failed_goto: string | null
    ask_approve_to_continue: boolean
  } | null
  next_status: {
    id: string
    name: string
    color: string
    agent_id: string | null
    on_failed_goto: string | null
    ask_approve_to_continue: boolean
  } | null
  active_session: {
    id: string
    agent_id: string
    agent_name: string
    last_activity_at: string
    status: string
  } | null
}

/**
 * Fetch all tickets for the current workspace
 */
export function useTickets(filters?: {
  status_id?: string
  assigned_to?: string
  created_by?: string
  include_drafts?: boolean
}) {
  const params = new URLSearchParams()
  if (filters?.status_id) params.set('status_id', filters.status_id)
  if (filters?.assigned_to) params.set('assigned_to', filters.assigned_to)
  if (filters?.created_by) params.set('created_by', filters.created_by)
  if (filters?.include_drafts) params.set('include_drafts', 'true')

  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => {
      const res = await fetch(`/api/tickets?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch tickets')
      const data = await res.json()
      return data.tickets as TicketWithRelations[]
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  })
}

/**
 * Fetch only draft tickets
 */
export function useDraftTickets() {
  return useTickets({ include_drafts: true }).data?.filter(t => t.creation_status === 'draft') || []
}

/**
 * Fetch a single ticket by ID
 */
export function useTicket(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) throw new Error('Ticket ID is required')
      const res = await fetch(`/api/tickets/${ticketId}`)
      if (!res.ok) throw new Error('Failed to fetch ticket')
      const data = await res.json()
      return data.ticket as TicketDetail
    },
    enabled: !!ticketId,
  })
}

/**
 * Create a new ticket
 */
export function useCreateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
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
    }) => {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to create ticket')
      }
      const data = await res.json()
      return data.ticket as TicketWithRelations
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

/**
 * Update an existing ticket
 */
export function useUpdateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      id: string
      title?: string
      description?: string
      status_id?: string
      assigned_to?: string | null
      flow_enabled?: boolean
      flow_mode?: TicketFlowMode
      creation_status?: TicketCreationStatus
      isSubTicket?: boolean
      parentTicketId?: string | null
      waitingFinishedTicketId?: string | null
    }) => {
      const res = await fetch(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: params.title,
          description: params.description,
          status_id: params.status_id,
          assigned_to: params.assigned_to,
          flow_enabled: params.flow_enabled,
          flow_mode: params.flow_mode,
          creation_status: params.creation_status,
          isSubTicket: params.isSubTicket,
          parentTicketId: params.parentTicketId,
          waitingFinishedTicketId: params.waitingFinishedTicketId,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to update ticket')
      }
      const data = await res.json()
      return data.ticket as TicketWithRelations
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.id] })
    },
  })
}

/**
 * Delete a ticket
 */
export function useDeleteTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to delete ticket')
      }
      return ticketId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

/**
 * Fetch comments for a ticket
 */
export function useTicketComments(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      if (!ticketId) throw new Error('Ticket ID is required')
      const res = await fetch(`/api/tickets/${ticketId}/comments`)
      if (!res.ok) throw new Error('Failed to fetch comments')
      const data = await res.json()
      return data.comments as Array<{
        id: string
        content: string
        created_by: { id: string; email: string }
        created_at: string
        updated_at: string
        is_agent_completion_signal: boolean
      }>
    },
    enabled: !!ticketId,
  })
}

/**
 * Add a comment to a ticket
 */
export function useAddTicketComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      ticketId: string
      content: string
      is_agent_completion_signal?: boolean
    }) => {
      const res = await fetch(`/api/tickets/${params.ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: params.content,
          is_agent_completion_signal: params.is_agent_completion_signal || false,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to add comment')
      }
      const data = await res.json()
      return data.comment
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', variables.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] })
    },
  })
}

/**
 * Fetch flow configuration for a ticket
 */
export function useTicketFlowConfig(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-flow-config', ticketId],
    queryFn: async () => {
      if (!ticketId) throw new Error('Ticket ID is required')
      const res = await fetch(`/api/tickets/${ticketId}/flow-config`)
      if (!res.ok) throw new Error('Failed to fetch flow config')
      const data = await res.json()
      return data.flow_configs as TicketFlowConfigWithStatus[]
    },
    enabled: !!ticketId,
  })
}

/**
 * Initialize flow configuration for a ticket
 */
export function useInitializeTicketFlowConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(`/api/tickets/${ticketId}/flow-config/initialize`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to initialize flow config')
      }
      const data = await res.json()
      return data.flow_configs as TicketFlowConfigWithStatus[]
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['ticket-flow-config', variables], data)
    },
  })
}

/**
 * Update flow configuration for a ticket
 */
export function useUpdateTicketFlowConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      ticketId: string
      configs: Array<{
        id?: string
        status_id: string
        flow_order: number
        agent_id?: string | null
        on_failed_goto?: string | null
        ask_approve_to_continue?: boolean
        instructions_override?: string
        is_included?: boolean
      }>
    }) => {
      const res = await fetch(`/api/tickets/${params.ticketId}/flow-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: params.configs }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to update flow config')
      }
      const data = await res.json()
      return data.flow_configs as TicketFlowConfigWithStatus[]
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['ticket-flow-config', variables.ticketId], data)
    },
  })
}

/**
 * Fetch flow status for a ticket
 */
export function useTicketFlowStatus(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-flow-status', ticketId],
    queryFn: async () => {
      if (!ticketId) throw new Error('Ticket ID is required')
      const res = await fetch(`/api/tickets/${ticketId}/flow`)
      if (!res.ok) throw new Error('Failed to fetch flow status')
      return res.json() as Promise<TicketFlowRuntimeStatus>
    },
    enabled: !!ticketId,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

/**
 * Advance flow to next status
 */
export function useAdvanceTicketFlow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      ticketId: string
      result: 'finished' | 'failed'
      notes?: string
    }) => {
      const res = await fetch(`/api/tickets/${params.ticketId}/flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: params.result,
          notes: params.notes,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to advance flow')
      }
      return res.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-flow-status', variables.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

/**
 * Start ticket flow runtime
 */
export function useStartTicketFlow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { ticketId: string }) => {
      const res = await fetch(`/api/tickets/${params.ticketId}/flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to start flow')
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-flow-status', variables.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

/**
 * Stop ticket flow runtime
 */
export function useStopTicketFlow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { ticketId: string }) => {
      const res = await fetch(`/api/tickets/${params.ticketId}/flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to stop flow')
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-flow-status', variables.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

/**
 * Bulk start ticket flow runtime
 */
export function useBulkStartTicketFlow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketIds: string[]) => {
      const res = await fetch('/api/tickets/flow/bulk-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketIds }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to bulk start flow')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

/**
 * Bulk stop ticket flow runtime
 */
export function useBulkStopTicketFlow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketIds: string[]) => {
      const res = await fetch('/api/tickets/flow/bulk-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketIds }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to bulk stop flow')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

/**
 * Publish a draft ticket (change creation_status from 'draft' to 'active')
 */
export function usePublishDraftTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_status: 'active' }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to publish ticket')
      }
      const data = await res.json()
      return data.ticket as TicketWithRelations
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket', variables] })
    },
  })
}
