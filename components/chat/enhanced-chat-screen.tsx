'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useChatMessagesWithGateway,
  useSendMessageStream,
} from '@/lib/query/hooks/useChat'
import { useChatWebSocket } from '@/lib/hooks/useChatWebSocket'
import { useGatewayConnection } from '@/lib/hooks/useGatewayService'
import { useSessionIdle } from '@/lib/hooks/useSessionIdle'
import { useSessionActivity } from '@/lib/hooks/useSessionActivity'
import { useStreamingChat } from '@/lib/hooks/useStreamingChat'
import type { ChatSession } from '@/lib/db/schema'
import { ChatMessages } from './chat-messages'
import { ActivityStatusBar } from './activity-status-bar'
import { ToolCallCard } from './tool-call-card'
import { ChatInput } from './chat-input'
import { StreamingMessage } from './streaming-message'
import { TypingIndicator } from './typing-indicator'
import { useChatHeader } from './hooks/useChatHeader'
import { useWSMessageHandler } from './hooks/useWSMessageHandler'

interface ChatScreenProps {
  session: ChatSession
}

export function EnhancedChatScreen({ session }: ChatScreenProps) {
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()
  const {
    messages = [],
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useChatMessagesWithGateway(session.id)
  const sendMessageStream = useSendMessageStream()

  // Extract runId helper
  const extractRunIdFromMetadata = (metadata: unknown): string | null => {
    try {
      if (!metadata) return null
      const parsed =
        typeof metadata === 'string' ? JSON.parse(metadata) : metadata
      if (!parsed || typeof parsed !== 'object') return null
      return (parsed as any).runId ?? null
    } catch {
      return null
    }
  }

  // Streaming chat state
  const {
    stream,
    activity,
    toolCalls,
    isStreaming,
    startStream,
    appendDelta,
    completeStream,
    errorStream,
    abortStream,
    setActivity,
    addToolCall,
    updateToolCall,
    clearStream,
  } = useStreamingChat({ sessionId: session.id, enabled: true })

  // Idle detection
  const { isIdle, isGenerating } = useSessionIdle({
    sessionId: session.id,
    sessionStatus: session.status,
    enabled: true,
  })

  // Track user activity
  useSessionActivity({
    sessionId: session.id,
    enabled: true,
    heartbeatInterval: 30000,
  })

  // Header hook (title, description, summarize)
  const {
    isEditingTitle,
    editedTitle,
    setEditedTitle,
    titleInputRef,
    handleTitleClick,
    handleTitleSave,
    handleTitleCancel,
    handleTitleKeyDown,
    isEditingDescription,
    editedDescription,
    setEditedDescription,
    descriptionInputRef,
    descriptionText,
    descriptionPreview,
    hasLongDescription,
    handleDescriptionClick,
    handleDescriptionSave,
    handleDescriptionCancel,
    handleDescriptionKeyDown,
    summaryError,
    handleSummarize,
    generateSummary,
  } = useChatHeader({ session })

  // WebSocket message handler hook
  const { handleWSMessage } = useWSMessageHandler({
    sessionId: session.id,
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
    extractRunIdFromMetadata,
  })

  // WebSocket connection
  const {
    isConnected: isWsConnected,
    sendChatMessage: wsSendChatMessage,
    abortChat: wsAbortChat,
  } = useChatWebSocket({
    sessionId: session.id,
    agentId: session.agent_id,
    onMessage: handleWSMessage,
    enabled: true,
    useInstanceBridge: true,
  })

  // Gateway connection status
  const { isConnected: isGatewayConnected } = useGatewayConnection()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, stream, toolCalls])

  // Reliability polling fallback
  useEffect(() => {
    const hasActiveRun =
      !!stream?.runId &&
      (stream.state === 'streaming' || stream.state === 'connecting')

    const shouldPoll = isTyping || isStreaming || hasActiveRun
    if (!shouldPoll) return

    const intervalMs = isWsConnected ? 3000 : 2000
    const interval = setInterval(() => {
      refetchMessages()
    }, intervalMs)

    return () => clearInterval(interval)
  }, [
    isTyping,
    isStreaming,
    stream?.runId,
    stream?.state,
    isWsConnected,
    refetchMessages,
  ])

  // Complete stream if final message was persisted
  useEffect(() => {
    if (!stream?.runId) return

    const finalByRunId = messages.find((msg: any) => {
      if (msg.role !== 'assistant') return false
      const runId = extractRunIdFromMetadata(msg.metadata)
      return runId === stream.runId
    })

    if (finalByRunId) {
      completeStream(stream.runId, finalByRunId)
      setIsTyping(false)
    }
  }, [messages, stream?.runId, completeStream])

  // Send message handler
  const handleSendMessage = async (
    content: string,
    attachments?: Array<{
      name: string
      mimeType: string
      size: number
      kind: string
      dataBase64?: string
    }>
  ) => {
    try {
      clearStream()
      setIsTyping(true)

      console.info('[EnhancedChatScreen] handleSendMessage called', {
        contentLength: content?.length || 0,
        contentFirst50: content?.slice(0, 50) || '(empty)',
        attachmentsCount: attachments?.length || 0,
        attachmentsDetail: attachments?.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          hasData: !!a.dataBase64,
        })),
      })

      // Pass attachments to WebSocket if supported
      const sentViaWs = wsSendChatMessage(content, {
        deliver: true,
        attachments,
      })

      if (!sentViaWs) {
        const result = await sendMessageStream.mutateAsync({
          sessionId: session.id,
          content,
          attachments,
        })

        if (result && result.runId) {
          console.log(
            '[EnhancedChatScreen] Message queued with runId:',
            result.runId
          )
          startStream(result.runId)
        }
      }

      if (
        (!session.title || session.title === 'New Chat') &&
        messages.length === 0
      ) {
        // generateTitle would be called here - handled by useChatHeader
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsTyping(false)
    }
  }

  // Abort handler
  const handleAbort = () => {
    if (stream?.runId) {
      wsAbortChat(stream.runId)
      abortStream(stream.runId)
    }
    setIsTyping(false)
    clearStream()
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
    >
      {/* Header */}
      <div
        className="flex flex-shrink-0 items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'rgb(var(--border-color))' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white">
            {session.agent_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            {/* Title editing */}
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  className="flex-1 border-b-2 border-blue-500 bg-transparent text-lg font-semibold outline-none"
                  style={{ color: 'rgb(var(--text-primary))' }}
                />
                <button
                  onClick={handleTitleSave}
                  className="rounded bg-green-100 p-1 text-green-600 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                  title="Save (Enter)"
                >
                  ✓
                </button>
                <button
                  onClick={handleTitleCancel}
                  className="rounded bg-red-100 p-1 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  title="Cancel (Esc)"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2
                  className="truncate text-lg font-semibold"
                  style={{ color: 'rgb(var(--text-primary))' }}
                >
                  {session.title || 'New Chat'}
                </h2>
                <button
                  onClick={handleTitleClick}
                  className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:bg-gray-100 hover:opacity-100 dark:hover:bg-gray-800"
                  title="Edit title and description"
                >
                  ✏️
                </button>
              </div>
            )}

            <p
              className="flex items-center gap-2 text-sm"
              style={{ color: 'rgb(var(--text-secondary))' }}
            >
              <span>🤖 {session.agent_name}</span>
              {isGatewayConnected ? (
                <span className="text-xs text-green-600 dark:text-green-400">
                  ● Live
                </span>
              ) : (
                <span className="text-xs text-red-600 dark:text-red-400">
                  ● Offline
                </span>
              )}
            </p>

            {/* Description editing */}
            {isEditingDescription ? (
              <div className="mt-2 flex items-start gap-2">
                <textarea
                  ref={descriptionInputRef}
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onKeyDown={handleDescriptionKeyDown}
                  className="flex-1 resize-none overflow-hidden border-b-2 border-blue-500 bg-transparent text-sm outline-none"
                  style={{
                    color: 'rgb(var(--text-primary))',
                    minHeight: '24px',
                    maxHeight: '80px',
                  }}
                  rows={1}
                  placeholder="Add a description..."
                />
                <button
                  onClick={handleDescriptionSave}
                  className="rounded bg-green-100 p-1 text-green-600 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                  title="Save (Enter)"
                >
                  ✓
                </button>
                <button
                  onClick={handleDescriptionCancel}
                  className="rounded bg-red-100 p-1 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  title="Cancel (Esc)"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {descriptionText ? (
                    hasLongDescription ? (
                      <details className="text-sm">
                        <summary
                          className="cursor-pointer opacity-85 transition-opacity hover:opacity-100"
                          style={{ color: 'rgb(var(--text-secondary))' }}
                        >
                          {descriptionPreview}
                        </summary>
                        <p
                          className="mt-2 whitespace-pre-wrap break-words"
                          style={{ color: 'rgb(var(--text-secondary))' }}
                        >
                          {descriptionText}
                        </p>
                      </details>
                    ) : (
                      <p
                        className="truncate text-sm"
                        style={{ color: 'rgb(var(--text-secondary))' }}
                      >
                        {descriptionText}
                      </p>
                    )
                  ) : (
                    <p
                      className="truncate text-sm"
                      style={{
                        color: 'rgb(var(--text-tertiary))',
                        fontStyle: 'italic',
                      }}
                    >
                      Add a description...
                    </p>
                  )}
                </div>
                <button
                  onClick={handleDescriptionClick}
                  className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:bg-gray-100 hover:opacity-100 dark:hover:bg-gray-800"
                  title="Edit description"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {isGenerating && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span>Summarizing...</span>
            </div>
          )}
          <button
            onClick={handleSummarize}
            disabled={generateSummary.isPending || isStreaming}
            className="rounded-lg bg-purple-100 px-3 py-1.5 text-sm text-purple-700 transition-colors hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
            title="Generate summary using your selected summarizer agent"
          >
            {generateSummary.isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <span>Summarizing...</span>
              </span>
            ) : (
              '📝 Summarize'
            )}
          </button>
          {(isStreaming || isTyping) && (
            <button
              onClick={handleAbort}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Activity Status Bar */}
      <ActivityStatusBar activity={activity} />

      {/* Summary error */}
      {summaryError && (
        <div className="mx-6 mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Summary failed: {summaryError}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <ChatMessages messages={messages} loading={messagesLoading} />

        {stream && stream.text && (
          <StreamingMessage
            content={JSON.stringify([{ type: 'text', text: stream.text }])}
            isStreaming={stream.state === 'streaming'}
            agentName={session.agent_name}
            error={stream.error}
          />
        )}

        {toolCalls.map((tool) => (
          <ToolCallCard key={tool.id} tool={tool} />
        ))}

        {isTyping && !stream?.text && toolCalls.length === 0 && (
          <TypingIndicator
            agentName={session.agent_name}
            message={activity.message || 'is working'}
            variant="dots"
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={sendMessageStream.isPending}
        placeholder={`Message ${session.agent_name}...`}
      />
    </div>
  )
}
