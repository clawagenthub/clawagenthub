'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useChatMessagesWithGateway, useSendMessageStream } from '@/lib/query/hooks/useChat'
import { useChatWebSocket } from '@/lib/hooks/useChatWebSocket'
import { useSessionActivity } from '@/lib/hooks/useSessionActivity'
import { useStreamingChat } from '@/lib/hooks/useStreamingChat'
import type { ChatSession } from '@/lib/db/schema'
import { ActivityStatusBar } from './activity-status-bar'
import { ChatBody } from './chat-body'
import { ChatHeader } from './chat-header'
import { ChatInput } from './chat-input'
import { useChatHeader } from './hooks/useChatHeader'
import { useWSMessageHandler } from './hooks/useWSMessageHandler'
import logger, { logCategories } from '@/lib/logger/index.js'

interface ChatScreenProps {
  session: ChatSession
}

function extractRunIdFromMetadata(metadata: unknown): string | null {
  try {
    if (!metadata) return null
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    if (!parsed || typeof parsed !== 'object') return null
    return (parsed as any).runId ?? null
  } catch { return null }
}

export function EnhancedChatScreen({ session }: ChatScreenProps) {
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useChatMessagesWithGateway(session.id)
  const sendMessageStream = useSendMessageStream()

  const { stream, activity, toolCalls, isStreaming, startStream, appendDelta, completeStream, errorStream, abortStream, setActivity, addToolCall, updateToolCall, clearStream } = useStreamingChat({ sessionId: session.id, enabled: true })

  useSessionActivity({ sessionId: session.id, enabled: true, heartbeatInterval: 30000 })

  const { summaryError, generateSummary } = useChatHeader({ session })

  const { handleWSMessage } = useWSMessageHandler({
    sessionId: session.id, stream, activity, toolCalls, appendDelta, completeStream, errorStream, setActivity, addToolCall, updateToolCall, refetchMessages, extractRunIdFromMetadata,
  })

  const { isConnected: isWsConnected, sendChatMessage: wsSendChatMessage, abortChat: wsAbortChat } = useChatWebSocket({
    sessionId: session.id, agentId: session.agent_id, onMessage: handleWSMessage, enabled: true, useInstanceBridge: true,
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, stream, toolCalls])

  useEffect(() => {
    const hasActiveRun = !!stream?.runId && (stream.state === 'streaming' || stream.state === 'connecting')
    const shouldPoll = isTyping || isStreaming || hasActiveRun
    if (!shouldPoll) return
    const intervalMs = isWsConnected ? 3000 : 2000
    const interval = setInterval(() => { refetchMessages() }, intervalMs)
    return () => clearInterval(interval)
  }, [isTyping, isStreaming, stream?.runId, stream?.state, isWsConnected, refetchMessages])

  useEffect(() => {
    if (!stream?.runId) return
    const finalByRunId = messages.find((msg: any) => {
      if (msg.role !== 'assistant') return false
      const runId = extractRunIdFromMetadata(msg.metadata)
      return runId === stream.runId
    })
    if (finalByRunId) { completeStream(stream.runId, finalByRunId); setIsTyping(false) }
  }, [messages, stream?.runId, completeStream])

  const handleSendMessage = async (content: string, attachments?: Array<{ name: string; mimeType: string; size: number; kind: string; dataBase64?: string }>) => {
    try {
      clearStream(); setIsTyping(true)
      const sentViaWs = wsSendChatMessage(content, { deliver: true, attachments })
      if (!sentViaWs) {
        const result = await sendMessageStream.mutateAsync({ sessionId: session.id, content, attachments })
        if (result?.runId) startStream(result.runId)
      }
    } catch (error) {
      logger.error({ category: logCategories.CHAT }, 'Failed to send message: %s', error)
      setIsTyping(false)
    }
  }

  const handleAbort = () => {
    if (stream?.runId) { wsAbortChat(stream.runId); abortStream(stream.runId) }
    setIsTyping(false); clearStream()
  }

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
      <ChatHeader session={session} isStreaming={isStreaming} generateSummary={generateSummary} />
      <ActivityStatusBar activity={activity} />
      {summaryError && (
        <div className="mx-6 mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Summary failed: {summaryError}
        </div>
      )}
      <ChatBody messages={messages} loading={messagesLoading} stream={stream} toolCalls={toolCalls} isTyping={isTyping} agentName={session.agent_name} activity={activity} />
      <div className="flex items-center gap-2 px-6 py-3">
        {(isStreaming || isTyping) && (
          <button onClick={handleAbort} className="rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50">Stop</button>
        )}
      </div>
      <ChatInput onSend={handleSendMessage} disabled={sendMessageStream.isPending} placeholder={`Message ${session.agent_name}...`} />
      <div ref={messagesEndRef} />
    </div>
  )
}
