'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { TypingIndicator } from './typing-indicator'
import { useChatMessages, useSendMessage } from '@/lib/query/hooks/useChat'
import { useChatWebSocket, type WSEvent } from '@/lib/hooks/useChatWebSocket'
import type { ChatSession, MCPActivity } from '@/lib/db/schema'

interface ChatScreenProps {
  session: ChatSession
}

export function ChatScreen({ session }: ChatScreenProps) {
  const [isTyping, setIsTyping] = useState(false)
  const [mcpActivity, setMcpActivity] = useState<MCPActivity | null>(null)
  const { data: messages = [], isLoading: messagesLoading } = useChatMessages(session.id)
  const sendMessage = useSendMessage()

  // Handle WebSocket events
  const handleWSMessage = (event: WSEvent) => {
    if (event.sessionId !== session.id) return

    switch (event.type) {
      case 'typing.start':
        setIsTyping(true)
        break

      case 'typing.stop':
        setIsTyping(false)
        setMcpActivity(null)
        break

      case 'mcp.start':
        setMcpActivity({ tool: event.tool, action: event.action })
        break

      case 'mcp.complete':
        setMcpActivity(null)
        break

      case 'message.complete':
        // Message will be refetched by React Query
        setIsTyping(false)
        setMcpActivity(null)
        break
    }
  }

  // Connect to WebSocket
  const { isConnected } = useChatWebSocket({
    sessionId: session.id,
    onMessage: handleWSMessage,
    enabled: true,
  })

  const handleSendMessage = async (content: string) => {
    try {
      await sendMessage.mutateAsync({
        sessionId: session.id,
        content,
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: 'rgb(var(--border-color))' }}
      >
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: 'rgb(var(--text-primary))' }}
          >
            {session.title || 'New Chat'}
          </h2>
          <p
            className="text-sm"
            style={{ color: 'rgb(var(--text-secondary))' }}
          >
            🤖 {session.agent_name}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="text-xs text-green-600 dark:text-green-400">
              ● Connected
            </span>
          ) : (
            <span className="text-xs text-red-600 dark:text-red-400">
              ● Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ChatMessages messages={messages} loading={messagesLoading} />
        {isTyping && (
          <TypingIndicator
            agentName={session.agent_name}
            mcpActivity={mcpActivity}
          />
        )}
      </div>

      {/* Input Area */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={sendMessage.isPending || isTyping}
        placeholder={`Message ${session.agent_name}...`}
      />
    </div>
  )
}
