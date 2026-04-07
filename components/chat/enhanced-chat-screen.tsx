'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChatMessagesWithGateway, useSendMessageStream } from '@/lib/query/hooks/useChat'
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
  const { messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useChatMessagesWithGateway(session.id)
  const sendMessageStream = useSendMessageStream()

  // Extract runId helper
  const extractRunIdFromMetadata = (metadata: unknown): string | null => {
    try {
      if (!metadata) return null
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
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
  }, [isTyping, isStreaming, stream?.runId, stream?.state, isWsConnected, refetchMessages])

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
  const handleSendMessage = async (content: string) => {
    try {
      clearStream()
      setIsTyping(true)

      const sentViaWs = wsSendChatMessage(content, { deliver: true })

      if (!sentViaWs) {
        const result = await sendMessageStream.mutateAsync({
          sessionId: session.id,
          content,
        })

        if (result && result.runId) {
          console.log('[EnhancedChatScreen] Message queued with runId:', result.runId)
          startStream(result.runId)
        }
      }

      if ((!session.title || session.title === 'New Chat') && messages.length === 0) {
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
    <div className="flex flex-col h-full" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'rgb(var(--border-color))' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {session.agent_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {/* Title editing */}
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  className="text-lg font-semibold bg-transparent border-b-2 border-blue-500 outline-none flex-1"
                  style={{ color: 'rgb(var(--text-primary))' }}
                />
                <button
                  onClick={handleTitleSave}
                  className="p-1 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  title="Save (Enter)"
                >
                  ✓
                </button>
                <button
                  onClick={handleTitleCancel}
                  className="p-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  title="Cancel (Esc)"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2
                  className="text-lg font-semibold truncate"
                  style={{ color: 'rgb(var(--text-primary))' }}
                >
                  {session.title || 'New Chat'}
                </h2>
                <button
                  onClick={handleTitleClick}
                  className="opacity-60 hover:opacity-100 transition-opacity text-gray-400 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Edit title and description"
                >
                  ✏️
                </button>
              </div>
            )}

            <p className="text-sm flex items-center gap-2" style={{ color: 'rgb(var(--text-secondary))' }}>
              <span>🤖 {session.agent_name}</span>
              {isGatewayConnected ? (
                <span className="text-xs text-green-600 dark:text-green-400">● Live</span>
              ) : (
                <span className="text-xs text-red-600 dark:text-red-400">● Offline</span>
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
                  className="flex-1 text-sm bg-transparent border-b-2 border-blue-500 outline-none resize-none overflow-hidden"
                  style={{ color: 'rgb(var(--text-primary))', minHeight: '24px', maxHeight: '80px' }}
                  rows={1}
                  placeholder="Add a description..."
                />
                <button
                  onClick={handleDescriptionSave}
                  className="p-1 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  title="Save (Enter)"
                >
                  ✓
                </button>
                <button
                  onClick={handleDescriptionCancel}
                  className="p-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  title="Cancel (Esc)"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-1">
                <div className="min-w-0 flex-1">
                  {descriptionText ? (
                    hasLongDescription ? (
                      <details className="text-sm">
                        <summary
                          className="cursor-pointer opacity-85 hover:opacity-100 transition-opacity"
                          style={{ color: 'rgb(var(--text-secondary))' }}
                        >
                          {descriptionPreview}
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap break-words" style={{ color: 'rgb(var(--text-secondary))' }}>
                          {descriptionText}
                        </p>
                      </details>
                    ) : (
                      <p className="text-sm truncate" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {descriptionText}
                      </p>
                    )
                  ) : (
                    <p className="text-sm truncate" style={{ color: 'rgb(var(--text-tertiary))', fontStyle: 'italic' }}>
                      Add a description...
                    </p>
                  )}
                </div>
                <button
                  onClick={handleDescriptionClick}
                  className="opacity-60 hover:opacity-100 transition-opacity text-gray-400 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
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
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Summarizing...</span>
            </div>
          )}
          <button
            onClick={handleSummarize}
            disabled={generateSummary.isPending || isStreaming}
            className="px-3 py-1.5 text-sm rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate summary using your selected summarizer agent"
          >
            {generateSummary.isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span>Summarizing...</span>
              </span>
            ) : (
              '📝 Summarize'
            )}
          </button>
          {(isStreaming || isTyping) && (
            <button
              onClick={handleAbort}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
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
        <div className="mx-6 mt-3 px-3 py-2 rounded-lg text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
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

        {toolCalls.map(tool => (
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
