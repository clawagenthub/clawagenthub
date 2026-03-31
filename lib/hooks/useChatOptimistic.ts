import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, ChatContentBlock } from '@/lib/db/schema'

export interface OptimisticMessage extends ChatMessage {
  isOptimistic: boolean
  status: 'sending' | 'sent' | 'error'
  errorMessage?: string
  runId?: string
}

export interface UseChatOptimisticOptions {
  onSend?: (content: string, runId: string) => Promise<void>
  onError?: (error: Error) => void
}

export interface UseChatOptimisticReturn {
  optimisticMessages: OptimisticMessage[]
  sendMessage: (content: string) => Promise<string | null>
  updateMessageStatus: (runId: string, status: 'sent' | 'error', message?: ChatMessage) => void
  removeOptimistic: (runId: string) => void
  isSending: boolean
}

export function useChatOptimistic(
  existingMessages: ChatMessage[],
  options: UseChatOptimisticOptions = {}
): UseChatOptimisticReturn {
  const { onSend, onError } = options
  
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const pendingRunIdsRef = useRef(new Set<string>())

  const sendMessage = useCallback(async (content: string): Promise<string | null> => {
    const runId = `opt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const tempId = `temp-${runId}`
    
    // Create optimistic message
    const optimisticMessage: OptimisticMessage = {
      id: tempId,
      session_id: '', // Will be filled by API
      role: 'user',
      content: JSON.stringify([{ type: 'text', text: content }] as ChatContentBlock[]),
      metadata: null,
      created_at: new Date().toISOString(),
      isOptimistic: true,
      status: 'sending',
      runId,
    }

    setIsSending(true)
    pendingRunIdsRef.current.add(runId)

    // Add optimistic message immediately
    setOptimisticMessages(prev => [...prev, optimisticMessage])

    try {
      // Call the send handler
      await onSend?.(content, runId)
      
      // Update status to sent
      setOptimisticMessages(prev =>
        prev.map(msg =>
          msg.runId === runId ? { ...msg, status: 'sent' as const } : msg
        )
      )
      
      return runId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      
      // Update status to error
      setOptimisticMessages(prev =>
        prev.map(msg =>
          msg.runId === runId
            ? { ...msg, status: 'error' as const, errorMessage }
            : msg
        )
      )
      
      onError?.(error instanceof Error ? error : new Error(errorMessage))
      return null
    } finally {
      setIsSending(false)
    }
  }, [onSend, onError])

  const updateMessageStatus = useCallback((
    runId: string,
    status: 'sent' | 'error',
    message?: ChatMessage
  ) => {
    setOptimisticMessages(prev => {
      const updated = prev.map(msg => {
        if (msg.runId === runId) {
          if (status === 'sent' && message) {
            // Replace optimistic message with real message
            return {
              ...message,
              isOptimistic: false,
              status: 'sent' as const,
              runId,
            }
          }
          return { ...msg, status, errorMessage: status === 'error' ? 'Failed to send' : undefined }
        }
        return msg
      })
      
      // Remove from pending set
      if (status === 'sent') {
        pendingRunIdsRef.current.delete(runId)
      }
      
      return updated
    })
  }, [])

  const removeOptimistic = useCallback((runId: string) => {
    setOptimisticMessages(prev => prev.filter(msg => msg.runId !== runId))
    pendingRunIdsRef.current.delete(runId)
  }, [])

  // Combine existing messages with optimistic ones
  const allMessages: OptimisticMessage[] = [
    ...existingMessages.map(msg => ({
      ...msg,
      isOptimistic: false,
      status: 'sent' as const,
    })),
    ...optimisticMessages,
  ]

  return {
    optimisticMessages: allMessages,
    sendMessage,
    updateMessageStatus,
    removeOptimistic,
    isSending,
  }
}
