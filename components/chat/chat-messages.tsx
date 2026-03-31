'use client'

import React, { useEffect, useRef } from 'react'
import { ChatMessage } from './chat-message'
import type { ChatMessage as ChatMessageType, ChatContentBlock } from '@/lib/db/schema'

interface ChatMessagesProps {
  messages: ChatMessageType[]
  loading?: boolean
}

export function ChatMessages({ messages, loading = false }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const parseMetadata = (metadata: unknown): Record<string, unknown> => {
    try {
      if (!metadata) return {}
      if (typeof metadata === 'string') {
        const parsed = JSON.parse(metadata)
        return parsed && typeof parsed === 'object' ? parsed : {}
      }
      return metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  const extractThinkingText = (metadata: unknown): string | null => {
    const meta = parseMetadata(metadata)
    const openclaw = meta.__openclaw && typeof meta.__openclaw === 'object'
      ? (meta.__openclaw as Record<string, unknown>)
      : {}

    const candidates: unknown[] = [
      meta.thinking,
      meta.reasoning,
      meta.thought,
      (meta as any).trace,
      openclaw.thinking,
      openclaw.reasoning,
      (openclaw as any).trace,
      (openclaw as any).thought,
    ]

    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        return c.trim()
      }
    }

    return null
  }

  const parseContentBlocks = (content: unknown): ChatContentBlock[] => {
    if (Array.isArray(content)) {
      return content as ChatContentBlock[]
    }

    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) return parsed as ChatContentBlock[]
      } catch {
        return [{ type: 'text', text: content }]
      }
    }

    return []
  }

  const withThinkingBlocks = (message: ChatMessageType): ChatContentBlock[] => {
    const baseBlocks = parseContentBlocks(message.content)
    if (message.role !== 'assistant') return baseBlocks

    const hasThinkingBlock = baseBlocks.some((b) => b?.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim())
    if (hasThinkingBlock) return baseBlocks

    const thinking = extractThinkingText(message.metadata as unknown)
    if (!thinking) return baseBlocks

    return [...baseBlocks, { type: 'thinking', thinking }]
  }

  const normalizeContent = (content: unknown): string => {
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          return parsed
            .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
            .map((block: any) => block.text)
            .join('\n')
        }
      } catch {
        return content
      }
      return content
    }

    if (Array.isArray(content)) {
      return content
        .filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
        .map((block: any) => block.text)
        .join('\n')
    }

    return JSON.stringify(content ?? '')
  }

  // Safety dedupe on the client side to avoid duplicate render keys when
  // local and gateway history overlap during merge races.
  const dedupedMessages = (() => {
    const seen = new Set<string>()
    const unique: ChatMessageType[] = []

    for (const message of messages) {
      const signature = `${message.role}:${message.created_at}:${normalizeContent(message.content)}`

      if (seen.has(message.id) || seen.has(signature)) {
        continue
      }

      seen.add(message.id)
      seen.add(signature)
      unique.push(message)
    }

    return unique
  })()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div style={{ color: 'rgb(var(--text-secondary))' }}>
          Loading messages...
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center" style={{ color: 'rgb(var(--text-secondary))' }}>
          <div className="text-4xl mb-4">💬</div>
          <p className="text-lg font-medium mb-2">No messages yet</p>
          <p className="text-sm">Start a conversation with the agent</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {dedupedMessages.map((message, index) => (
        <ChatMessage
          key={`${message.id}:${index}`}
          role={message.role}
          content={withThinkingBlocks(message)}
          timestamp={message.created_at}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
