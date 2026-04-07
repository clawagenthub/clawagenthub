'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface UseWSMessageHandlerProps {
  sessionId: string
  stream: any
  activity: any
  toolCalls: any[]
  appendDelta: (runId: string, chunk: string) => void
  completeStream: (runId: string, message: any) => any
  errorStream: (runId: string, error: string) => void
  setActivity: (activity: any) => void
  addToolCall: (tool: any) => string
  updateToolCall: (id: string, update: any) => void
  refetchMessages: () => void
  extractRunIdFromMetadata: (metadata: unknown) => string | null
}

export function useWSMessageHandler({
  sessionId,
  stream,
  activity,
  toolCalls,
  appendDelta,
  completeStream,
  errorStream,
  setActivity,
  addToolCall,
  updateToolCall,
  refetchMessages,
}: UseWSMessageHandlerProps) {
  const queryClient = useQueryClient()

  const handleWSMessage = useCallback((event: any) => {
    // Filter events for this session
    const eventSessionId = event.sessionId || event.data?.sessionId
    if (eventSessionId !== sessionId) return

    const eventType = event.type || event.data?.type

    console.log('[EnhancedChatScreen] WebSocket event:', eventType, event)

    switch (eventType) {
      case 'message.chunk':
      case 'chat.delta': {
        const chunk = event.chunk || event.data?.message?.content?.[0]?.text || ''
        const runId = event.data?.runId || event.runId
        if (runId && chunk) {
          // Ensure stream state exists even when message is sent via WS bridge
          if (!stream || stream.runId !== runId) {
            // startStream would be called here but it's managed externally
          }
          appendDelta(runId, chunk)
        }
        break
      }

      case 'message.complete':
      case 'chat.final': {
        const finalRunId = event.data?.runId || event.runId
        const finalMessage = event.data?.message || event.message
        if (finalRunId) {
          const committedMessage = completeStream(finalRunId, finalMessage)
          if (committedMessage) {
            queryClient.invalidateQueries({ queryKey: ['chat', 'messages', sessionId] })
          }
        }
        refetchMessages()
        break
      }

      case 'chat.error': {
        const errorRunId = event.data?.runId || event.runId
        const errorMessage = event.data?.errorMessage || event.errorMessage || 'An error occurred'
        if (errorRunId) {
          errorStream(errorRunId, errorMessage)
        }
        refetchMessages()
        break
      }

      case 'typing.start':
        // isTyping is managed externally
        break

      case 'typing.stop':
        // isTyping is managed externally
        break

      case 'agent.typing':
        // isTyping is managed externally
        break

      case 'agent': {
        const streamType = event.stream || event.data?.stream
        if (streamType === 'tool') {
          const toolName = event.data?.name || event.data?.data?.name || 'Tool'
          const phase = event.data?.phase || event.data?.data?.phase

          if (phase === 'start') {
            addToolCall({
              name: toolName,
              status: 'running',
              startedAt: Date.now(),
            })
          } else if (phase === 'end' || phase === 'error') {
            const toolResult = event.data?.result || event.data?.data?.result
            const runningTool = toolCalls.find((t: any) => t.name === toolName && t.status === 'running')
            if (runningTool) {
              updateToolCall(runningTool.id, {
                status: phase === 'error' ? 'error' : 'success',
                result: toolResult,
                completedAt: Date.now(),
              })
            }
          }
        } else if (streamType === 'lifecycle') {
          const phase = event.data?.phase || event.data?.data?.phase
          if (phase === 'start') {
            setActivity({ state: 'thinking', message: 'Thinking...', startedAt: Date.now() })
          }
        }
        break
      }

      case 'error':
        setActivity({ state: 'error', message: event.message || 'An error occurred', startedAt: Date.now() })
        break
    }
  }, [
    sessionId,
    stream,
    queryClient,
    appendDelta,
    completeStream,
    errorStream,
    setActivity,
    addToolCall,
    updateToolCall,
    toolCalls,
    refetchMessages,
  ])

  return { handleWSMessage }
}
