import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, ChatContentBlock } from '@/lib/db/schema'

export type StreamState = 'idle' | 'connecting' | 'streaming' | 'error' | 'aborted'

export interface StreamMessage {
  runId: string
  text: string
  state: StreamState
  startedAt: number
  completedAt?: number
  error?: string
}

export interface AgentActivity {
  state: 'idle' | 'thinking' | 'searching' | 'calling_mcp' | 'writing' | 'error'
  message?: string
  toolName?: string
  startedAt?: number
}

export interface ToolCall {
  id: string
  name: string
  status: 'running' | 'success' | 'error'
  result?: string
  startedAt: number
  completedAt?: number
}

export interface UseStreamingChatOptions {
  sessionId: string
  enabled?: boolean
}

export interface UseStreamingChatReturn {
  // Stream state
  stream: StreamMessage | null
  activity: AgentActivity
  toolCalls: ToolCall[]
  isStreaming: boolean
  
  // Actions
  startStream: (runId: string) => void
  appendDelta: (runId: string, delta: string) => void
  completeStream: (runId: string, message?: ChatMessage) => ChatMessage | null
  errorStream: (runId: string, error: string) => void
  abortStream: (runId: string) => void
  
  // Activity
  setActivity: (activity: AgentActivity) => void
  addToolCall: (tool: Omit<ToolCall, 'id'>) => string
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void
  removeToolCall: (id: string) => void
  
  // Clear
  clearStream: () => void
  clearToolCalls: () => void
}

export function useStreamingChat(
  options: UseStreamingChatOptions
): UseStreamingChatReturn {
  const { sessionId, enabled = true } = options
  
  const [stream, setStream] = useState<StreamMessage | null>(null)
  const [activity, setActivityState] = useState<AgentActivity>({ state: 'idle' })
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  
  const streamBufferRef = useRef<Map<string, string>>(new Map())
  const streamStartTimeRef = useRef<Map<string, number>>(new Map())

  const startStream = useCallback((runId: string) => {
    if (!enabled) return
    
    const now = Date.now()
    streamBufferRef.current.set(runId, '')
    streamStartTimeRef.current.set(runId, now)
    
    setStream({
      runId,
      text: '',
      state: 'streaming',
      startedAt: now,
    })
    
    setActivityState({ state: 'thinking', message: 'Thinking...', startedAt: now })
  }, [enabled])

  const appendDelta = useCallback((runId: string, delta: string) => {
    if (!enabled) return
    
    const currentText = streamBufferRef.current.get(runId) || ''
    const newText = currentText + delta
    streamBufferRef.current.set(runId, newText)
    
    setStream(prev => {
      if (prev?.runId === runId) {
        return {
          ...prev,
          text: newText,
        }
      }
      return prev
    })
    
    // Update activity to writing when we receive text
    if (delta.trim()) {
      setActivityState({ state: 'writing', message: 'Generating response...', startedAt: Date.now() })
    }
  }, [enabled])

  const completeStream = useCallback((runId: string, message?: ChatMessage): ChatMessage | null => {
    if (!enabled) return null
    
    const finalText = streamBufferRef.current.get(runId) || ''
    const startedAt = streamStartTimeRef.current.get(runId) || Date.now()
    const now = Date.now()
    
    // Clean up refs
    streamBufferRef.current.delete(runId)
    streamStartTimeRef.current.delete(runId)
    
    // Clear stream state
    setStream(null)
    setActivityState({ state: 'idle' })
    
    // If we have a message from the server, use it
    if (message) {
      return message
    }
    
    // Otherwise, create a message from the streamed text
    if (finalText.trim()) {
      return {
        id: `streamed-${runId}`,
        session_id: sessionId,
        role: 'assistant',
        content: JSON.stringify([{ type: 'text', text: finalText }] as ChatContentBlock[]),
        metadata: null,
        created_at: new Date(now).toISOString(),
      }
    }
    
    return null
  }, [enabled, sessionId])

  const errorStream = useCallback((runId: string, error: string) => {
    if (!enabled) return
    
    streamBufferRef.current.delete(runId)
    streamStartTimeRef.current.delete(runId)
    
    setStream(prev => {
      if (prev?.runId === runId) {
        return {
          ...prev,
          state: 'error',
          error,
          completedAt: Date.now(),
        }
      }
      return prev
    })
    
    setActivityState({ state: 'error', message: error, startedAt: Date.now() })
  }, [enabled])

  const abortStream = useCallback((runId: string) => {
    streamBufferRef.current.delete(runId)
    streamStartTimeRef.current.delete(runId)
    
    setStream(prev => {
      if (prev?.runId === runId) {
        return {
          ...prev,
          state: 'aborted',
          completedAt: Date.now(),
        }
      }
      return prev
    })
    
    setActivityState({ state: 'idle' })
  }, [])

  const setActivity = useCallback((newActivity: AgentActivity) => {
    setActivityState(newActivity)
  }, [])

  const addToolCall = useCallback((tool: Omit<ToolCall, 'id'>): string => {
    const id = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const newTool: ToolCall = { ...tool, id }
    
    setToolCalls(prev => [...prev, newTool])
    
    // Update activity when tool starts
    setActivityState({
      state: 'calling_mcp',
      message: `Using ${tool.name}...`,
      toolName: tool.name,
      startedAt: tool.startedAt,
    })
    
    return id
  }, [])

  const updateToolCall = useCallback((id: string, updates: Partial<ToolCall>) => {
    setToolCalls(prev => {
      const index = prev.findIndex(t => t.id === id)
      if (index === -1) return prev
      
      const updated = [...prev]
      updated[index] = { ...updated[index], ...updates }
      
      // If tool completed successfully and no more tools running, update activity
      if (updates.status === 'success' || updates.status === 'error') {
        const stillRunning = updated.some(t => t.status === 'running')
        if (!stillRunning) {
          setActivityState({ state: 'thinking', message: 'Processing...', startedAt: Date.now() })
        }
      }
      
      return updated
    })
  }, [])

  const removeToolCall = useCallback((id: string) => {
    setToolCalls(prev => prev.filter(t => t.id !== id))
  }, [])

  const clearStream = useCallback(() => {
    setStream(null)
    streamBufferRef.current.clear()
    streamStartTimeRef.current.clear()
  }, [])

  const clearToolCalls = useCallback(() => {
    setToolCalls([])
  }, [])

  return {
    stream,
    activity,
    toolCalls,
    isStreaming: stream?.state === 'streaming',
    
    startStream,
    appendDelta,
    completeStream,
    errorStream,
    abortStream,
    
    setActivity,
    addToolCall,
    updateToolCall,
    removeToolCall,
    
    clearStream,
    clearToolCalls,
  }
}
