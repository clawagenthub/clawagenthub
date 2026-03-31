import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserSettings } from '@/lib/db/schema'

interface UserSettingsResponse {
  settings: UserSettings & { id: string | null }
}

// Fetch user settings
export function useUserSettings() {
  return useQuery({
    queryKey: ['user', 'settings'],
    queryFn: async () => {
      const res = await fetch('/api/user/settings')
      if (!res.ok) throw new Error('Failed to fetch user settings')
      const data = await res.json() as UserSettingsResponse
      return data.settings
    },
    staleTime: 60000, // 1 minute
  })
}

// Update user settings
export function useUpdateUserSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      summarizer_agent_id?: string | null
      summarizer_gateway_id?: string | null
      auto_summary_enabled?: boolean
      idle_timeout_minutes?: number
    }) => {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error('Failed to update user settings')
      const data = await res.json() as UserSettingsResponse
      return data.settings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'settings'] })
    },
  })
}
