import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_PROMPTS } from '@/lib/utils/prompts'

const WORKSPACE_SETTINGS_KEY = 'workspace-settings'

// Simplified prompt structure stored in workspace settings
export interface WorkspacePrompt {
  id: string
  name: string
  description: string
  value: string  // The actual prompt text to paste
  isCustom: boolean
}

interface WorkspaceSettingsResponse {
  [key: string]: string | null
}

export function useWorkspacePrompts() {
  return useQuery({
    queryKey: [WORKSPACE_SETTINGS_KEY, 'workspace_prompts'],
    queryFn: async () => {
      const res = await fetch('/api/workspaces/settings')
      if (!res.ok) throw new Error('Failed to fetch workspace settings')
      const data = await res.json() as WorkspaceSettingsResponse
      const promptsValue = data.workspace_prompts
      
      // If workspace_prompts is not set (null/undefined), initialize with defaults for new workspace
      if (!promptsValue) {
        return DEFAULT_PROMPTS.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          value: p.value,
          isCustom: false,
        })) as WorkspacePrompt[]
      }
      
      // If promptsValue is set, try to parse it
      try {
        const parsed = JSON.parse(promptsValue) as WorkspacePrompt[]
        // Return the stored value (even if empty - user intentionally deleted all)
        return parsed
      } catch {
        // If JSON is malformed, return empty array (don't auto-reload defaults)
        return [] as WorkspacePrompt[]
      }
    },
    staleTime: 60000,
  })
}

export function useUpdateWorkspacePrompts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (prompts: WorkspacePrompt[]) => {
      const res = await fetch('/api/workspaces/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_prompts: JSON.stringify(prompts),
        }),
      })
      if (!res.ok) throw new Error('Failed to update workspace prompts')
      const data = await res.json() as WorkspaceSettingsResponse
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORKSPACE_SETTINGS_KEY] })
    },
  })
}

export function useAddCustomPrompt() {
  const { mutateAsync: updatePrompts } = useUpdateWorkspacePrompts()
  const { data: existingPrompts } = useWorkspacePrompts()

  return async (prompt: { name: string; description: string; value: string }) => {
    const newPrompt: WorkspacePrompt = {
      ...prompt,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isCustom: true,
    }
    const updatedPrompts = [...(existingPrompts || []), newPrompt]
    await updatePrompts(updatedPrompts)
    return newPrompt
  }
}

export function useDeletePromptMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ promptId, currentPrompts }: { promptId: string; currentPrompts: WorkspacePrompt[] }) => {
      const updatedPrompts = currentPrompts.filter(p => p.id !== promptId)
      const res = await fetch('/api/workspaces/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_prompts: JSON.stringify(updatedPrompts),
        }),
      })
      if (!res.ok) throw new Error('Failed to delete prompt')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORKSPACE_SETTINGS_KEY] })
    },
  })
}
