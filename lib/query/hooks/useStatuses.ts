import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Status } from '@/lib/db/schema'

/**
 * Fetch all statuses for the current workspace
 */
export function useStatuses() {
  return useQuery({
    queryKey: ['statuses'],
    queryFn: async () => {
      const res = await fetch('/api/statuses')
      if (!res.ok) throw new Error('Failed to fetch statuses')
      const data = await res.json()
      return data.statuses as Status[]
    },
  })
}

/**
 * Create a new status
 */
export function useCreateStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      name: string
      color: string
      description?: string
      priority?: number
      agent_id?: string | null
      is_flow_included?: boolean
      on_failed_goto?: string | null
      ask_approve_to_continue?: boolean
    }) => {
      const res = await fetch('/api/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to create status')
      }
      const data = await res.json()
      return data.status as Status
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] })
    },
  })
}

/**
 * Update an existing status
 */
export function useUpdateStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      id: string
      name?: string
      color?: string
      description?: string
      priority?: number
      agent_id?: string | null
      is_flow_included?: boolean
      on_failed_goto?: string | null
      ask_approve_to_continue?: boolean
    }) => {
      const res = await fetch(`/api/statuses/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          color: params.color,
          description: params.description,
          priority: params.priority,
          agent_id: params.agent_id,
          is_flow_included: params.is_flow_included,
          on_failed_goto: params.on_failed_goto,
          ask_approve_to_continue: params.ask_approve_to_continue,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to update status')
      }
      const data = await res.json()
      return data.status as Status
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] })
    },
  })
}

/**
 * Delete a status
 */
export function useDeleteStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (statusId: string) => {
      const res = await fetch(`/api/statuses/${statusId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to delete status')
      }
      return statusId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] })
    },
  })
}

/**
 * Reorder statuses (batch update priorities)
 */
export function useReorderStatuses() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (items: Array<{ id: string; priority: number }>) => {
      const res = await fetch('/api/statuses/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reorder statuses')
      }
      const data = await res.json()
      return data.statuses as Status[]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] })
    },
  })
}
