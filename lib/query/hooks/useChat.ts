import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AgentInfo, ChatSession, ChatMessage } from '@/lib/db/schema'
import logger from '@/lib/logger/index.js'


// Fetch available agents from connected gateways
export function useAgents() {
  return useQuery({
    queryKey: ['chat', 'agents'],
    queryFn: async () => {
      const res = await fetch('/api/chat/agents')
      if (!res.ok) throw new Error('Failed to fetch agents')
      const data = await res.json()
      return data.agents as AgentInfo[]
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

// Fetch chat sessions
export function useChatSessions() {
  return useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: async () => {
      logger.debug('[useChatSessions] Fetching sessions...')
      const res = await fetch('/api/chat/sessions')
      logger.debug('[useChatSessions] Response status:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text()
        logger.error('[useChatSessions] Failed to fetch sessions:', res.status, errorText)
        throw new Error('Failed to fetch sessions')
      }
      
      const data = await res.json()
      logger.debug('[useChatSessions] Sessions received:', data.sessions?.length || 0, 'sessions')
      return data.sessions as ChatSession[]
    },
    // Refetch sessions when window regains focus (user returns to tab)
    refetchOnWindowFocus: true,
    // Refetch sessions periodically (every 30 seconds) to show live status
    refetchInterval: 30000,
    // Consider data fresh for 15 seconds
    staleTime: 15000,
  })
}

// Create a new chat session
export function useCreateSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      gatewayId: string
      agentId: string
      agentName: string
    }) => {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error('Failed to create session')
      const data = await res.json()
      return data.session as ChatSession
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })
}

// Fetch messages for a specific session
export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat', 'messages', sessionId],
    queryFn: async () => {
      if (!sessionId) return []
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      return data.messages as ChatMessage[]
    },
    enabled: !!sessionId,
    refetchInterval: 5000, // Poll for new messages every 5 seconds
  })
}

// Send a message to an agent
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { sessionId: string; content: string; attachments?: Array<{ name: string; mimeType: string; size: number; kind: string; dataBase64?: string }> }) => {
      const res = await fetch(`/api/chat/sessions/${params.sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: params.content, attachments: params.attachments }),
      })
      if (!res.ok) throw new Error('Failed to send message')
      const data = await res.json()
      return data.message as ChatMessage
    },
    onSuccess: (_data, variables) => {
      // Invalidate messages query to fetch the agent's response
      queryClient.invalidateQueries({
        queryKey: ['chat', 'messages', variables.sessionId],
      })
    },
  })
}

// Send a message with streaming support (returns immediately with runId)
export function useSendMessageStream() {
  return useMutation({
    mutationFn: async (params: { sessionId: string; content: string; attachments?: Array<{ name: string; mimeType: string; size: number; kind: string; dataBase64?: string }> }) => {
      const res = await fetch(`/api/chat/sessions/${params.sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: params.content,
          attachments: params.attachments,
          stream: true, // Enable streaming mode
        }),
      })
      
      // 202 Accepted means message is queued
      if (res.status === 202) {
        const data = await res.json()
        return {
          runId: data.runId,
          status: 'queued' as const,
          message: data.message
        }
      }
      
      // Handle other responses
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send message')
      }
      
      const data = await res.json()
      return data as { runId: string; status: string }
    },
  })
}

// Update session title or description
export function useUpdateSessionTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { sessionId: string; title?: string; description?: string }) => {
      const body: { title?: string; description?: string } = {}
      if (params.title !== undefined) body.title = params.title
      if (params.description !== undefined) body.description = params.description
      
      const res = await fetch(`/api/chat/sessions/${params.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to update session')
      const data = await res.json()
      return data.session as ChatSession
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })
}

// Generate session summary using user's selected summarizer agent
export function useGenerateSessionSummary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/chat/sessions/${sessionId}/summarize`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate summary')
      }
      const data = await res.json()
      return data as { title: string; description: string; sessionId: string }
    },
    onSuccess: () => {
      // Invalidate sessions query to reflect the updated title/description
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })
}

// Generate session title using librarian agent
export function useGenerateSessionTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/chat/sessions/${sessionId}/generate-title`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to generate session title')
      const data = await res.json()
      return data.title as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })
}

// Send heartbeat to keep session marked as active
export function useHeartbeat() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/chat/sessions/${sessionId}/heartbeat`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to send heartbeat')
      const data = await res.json()
      return data as { success: boolean; status: string; last_activity_at: string }
    },
  })
}

// Auto-summarize an idle session
export function useAutoSummarize() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/chat/sessions/${sessionId}/auto-summarize`, {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to auto-summarize')
      }
      const data = await res.json()
      return data as { success: boolean; title: string; description: string; status: string }
    },
    onSuccess: () => {
      // Invalidate sessions query to reflect the updated status/title/description
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })
}

// Fetch messages from gateway (with deep merge)
// This pulls the latest messages from the OpenClaw gateway and merges with local messages
export function useGatewayMessages(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['chat', 'gateway', 'messages', sessionId],
    queryFn: async () => {
      if (!sessionId) return []
      const res = await fetch(`/api/chat/gateway/messages?sessionId=${sessionId}`)
      if (!res.ok) throw new Error('Failed to fetch gateway messages')
      const data = await res.json()
      return data.messages as ChatMessage[]
    },
    enabled: enabled && !!sessionId,
    staleTime: 0, // Always fresh - we want the latest from gateway
    refetchOnWindowFocus: true,
  })
}

// Combined hook that tries gateway first, falls back to local
// This ensures we always have the most up-to-date messages
export function useChatMessagesWithGateway(sessionId: string | null) {
  const localMessages = useChatMessages(sessionId)
  const gatewayMessages = useGatewayMessages(sessionId, localMessages.isSuccess)

  // Use gateway messages only when it actually has data.
  // If gateway returns an empty array, keep local DB messages visible.
  const local = localMessages.data || []
  const gateway = gatewayMessages.data || []
  const messages = gateway.length > 0 ? gateway : local
  const isLoading = localMessages.isLoading || gatewayMessages.isLoading
  const isError = localMessages.isError || gatewayMessages.isError

  return {
    messages,
    isLoading,
    isError,
    refetch: () => {
      localMessages.refetch()
      gatewayMessages.refetch()
    }
  }
}

// Check for idle sessions (admin/background function)
export function useCheckIdleSessions() {
  return useQuery({
    queryKey: ['chat', 'idle-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/chat/sessions/idle-check')
      if (!res.ok) throw new Error('Failed to check idle sessions')
      const data = await res.json()
      return data.sessions as Array<{
        session_id: string
        user_id: string
        title: string | null
        agent_name: string
        last_activity_at: string
        idle_minutes: number
        timeout_minutes: number
      }>
    },
    refetchInterval: 60000, // Check every minute
  })
}
