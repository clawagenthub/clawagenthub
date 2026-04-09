'use client'

import React from 'react'
import { ChatMessages } from './chat-messages'
import { ToolCallCard } from './tool-call-card'
import { StreamingMessage } from './streaming-message'
import { TypingIndicator } from './typing-indicator'

interface ChatBodyProps {
  messages: any[]
  loading: boolean
  stream: any
  toolCalls: any[]
  isTyping: boolean
  agentName: string
  activity: any
}

export function ChatBody({ messages, loading, stream, toolCalls, isTyping, agentName, activity }: ChatBodyProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <ChatMessages messages={messages} loading={loading} />

      {stream && stream.text && (
        <StreamingMessage
          content={JSON.stringify([{ type: 'text', text: stream.text }])}
          isStreaming={stream.state === 'streaming'}
          agentName={agentName}
          error={stream.error}
        />
      )}

      {toolCalls.map((tool) => (
        <ToolCallCard key={tool.id} tool={tool} />
      ))}

      {isTyping && !stream?.text && toolCalls.length === 0 && (
        <TypingIndicator
          agentName={agentName}
          message={activity?.message || 'is working'}
          variant="dots"
        />
      )}
    </div>
  )
}