/**
 * Workspace Members - TanStack Query Hooks
 */

import { useQuery } from '@tanstack/react-query'

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: string
  joined_at: string
  email: string
  is_superuser: number
}

interface WorkspaceMembersResponse {
  members: WorkspaceMember[]
}

export function useWorkspaceMembers() {
  return useQuery<WorkspaceMember[]>({
    queryKey: ['workspace-members'],
    queryFn: async () => {
      const response = await fetch('/api/workspaces/members')
      if (!response.ok) {
        throw new Error('Failed to fetch workspace members')
      }
      const data: WorkspaceMembersResponse = await response.json()
      return data.members
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Gateway agents - re-export from existing chat agents hook
export interface GatewayAgent {
  gatewayId: string
  gatewayName: string
  agentId: string
  agentName: string
  sessionKey: string
}

interface GatewayAgentsResponse {
  agents: GatewayAgent[]
}

export function useGatewayAgents() {
  return useQuery<GatewayAgent[]>({
    queryKey: ['gateway-agents'],
    queryFn: async () => {
      const response = await fetch('/api/chat/agents')
      if (!response.ok) {
        throw new Error('Failed to fetch gateway agents')
      }
      const data: GatewayAgentsResponse = await response.json()
      return data.agents
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - agents may change
    refetchInterval: 3 * 60 * 1000, // Refetch every 3 minutes
  })
}
