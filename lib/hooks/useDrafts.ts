/**
 * useDrafts Hook
 * Draft state management with use-lifecycle pattern
 * 
 * Functions:
 * - useDrafts() - List all drafts
 * - useDraft(id) - Get single draft
 * - useCreateDraft() - Create new draft
 * - useUpdateDraft() - Update draft
 * - useDeleteDraft() - Delete draft
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Draft } from '@/lib/db/schema'

// Draft with parsed metadata
export interface DraftWithMetadata extends Omit<Draft, 'metadata'> {
  metadata: Record<string, unknown> | null
}

// Response types
interface DraftsResponse {
  drafts: DraftWithMetadata[]
}

interface SingleDraftResponse {
  draft: DraftWithMetadata
}

interface DeleteResponse {
  success: boolean
  deleted: string
}

/**
 * List all drafts for workspace
 */
export function useDrafts(identityId?: string) {
  return useQuery<DraftWithMetadata[]>({
    queryKey: ['drafts', identityId],
    queryFn: async () => {
      const params = identityId ? `?identity_id=${identityId}` : ''
      const sessionToken = getSessionToken()
      const res = await fetch(`/api/${sessionToken}/drafts${params}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch drafts')
      const data: DraftsResponse = await res.json()
      return data.drafts
    },
  })
}

/**
 * Get single draft by ID
 */
export function useDraft(id: string) {
  return useQuery<DraftWithMetadata>({
    queryKey: ['draft', id],
    queryFn: async () => {
      const sessionToken = getSessionToken()
      const res = await fetch(`/api/${sessionToken}/drafts/${id}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch draft')
      const data: SingleDraftResponse = await res.json()
      return data.draft
    },
    enabled: !!id,
  })
}

/**
 * Create a new draft
 */
export function useCreateDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      identity_id: string
      title?: string | null
      content?: string | null
      excerpt?: string | null
      scheduled_at?: string | null
      visibility?: 'public' | 'connections' | 'private'
      source_platform?: string | null
      metadata?: Record<string, unknown>
    }) => {
      const sessionToken = getSessionToken()
      const res = await fetch(`/api/${sessionToken}/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to create draft')
      }
      return res.json() as Promise<SingleDraftResponse>
    },
    onSuccess: (data) => {
      // Invalidate drafts list to refetch
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
      // Add to cache directly
      queryClient.setQueryData<DraftWithMetadata>(
        ['draft', data.draft.id],
        data.draft
      )
    },
  })
}

/**
 * Update an existing draft
 */
export function useUpdateDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id: string
      title?: string | null
      content?: string | null
      excerpt?: string | null
      scheduled_at?: string | null
      visibility?: 'public' | 'connections' | 'private'
      source_platform?: string | null
      metadata?: Record<string, unknown>
    }) => {
      const { id, ...updateData } = data
      const sessionToken = getSessionToken()
      const res = await fetch(`/api/${sessionToken}/drafts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to update draft')
      }
      return res.json() as Promise<SingleDraftResponse>
    },
    onSuccess: (data, variables) => {
      // Update single draft cache
      queryClient.setQueryData<DraftWithMetadata>(
        ['draft', variables.id],
        data.draft
      )
      // Invalidate drafts list
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
    },
  })
}

/**
 * Delete a draft
 */
export function useDeleteDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const sessionToken = getSessionToken()
      const res = await fetch(`/api/${sessionToken}/drafts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to delete draft')
      }
      return res.json() as Promise<DeleteResponse>
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['draft', id] })
      // Invalidate drafts list
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
    },
  })
}

/**
 * Save draft (create or update based on presence of id)
 */
export function useSaveDraft() {
  const createDraft = useCreateDraft()
  const updateDraft = useUpdateDraft()

  return {
    ...createDraft,
    mutate: (data: {
      id?: string
      identity_id: string
      title?: string | null
      content?: string | null
      excerpt?: string | null
      scheduled_at?: string | null
      visibility?: 'public' | 'connections' | 'private'
      source_platform?: string | null
      metadata?: Record<string, unknown>
    }) => {
      if (data.id) {
        return updateDraft.mutate({ id: data.id, ...data })
      }
      return createDraft.mutate(data)
    },
    mutateAsync: async (data: {
      id?: string
      identity_id: string
      title?: string | null
      content?: string | null
      excerpt?: string | null
      scheduled_at?: string | null
      visibility?: 'public' | 'connections' | 'private'
      source_platform?: string | null
      metadata?: Record<string, unknown>
    }) => {
      if (data.id) {
        return updateDraft.mutateAsync({ id: data.id, ...data })
      }
      return createDraft.mutateAsync(data)
    },
  }
}

// Helper to get session token
function getSessionToken(): string {
  // In a real implementation, this would come from context or storage
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('sessionId') || ''
  }
  return ''
}