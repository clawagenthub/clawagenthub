'use client'

import React from 'react'
import type { ChatContentBlock } from '@/lib/db/schema'

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system'
  content: ChatContentBlock[]
  timestamp: string
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === 'user'
  const isSystem = role === 'system'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isSystem ? 'justify-center' : ''} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : isSystem
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 italic text-sm'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
      >
        {content.map((block, index) => (
          <div key={index}>
            {block.type === 'text' && block.text && (
              <p className="whitespace-pre-wrap break-words">{block.text}</p>
            )}
            {block.type === 'thinking' && block.thinking && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm opacity-70">
                  💭 Thinking...
                </summary>
                <p className="mt-2 text-sm opacity-80 whitespace-pre-wrap">
                  {block.thinking}
                </p>
              </details>
            )}
            {block.type === 'toolCall' && block.toolCall && (
              <div className="mt-2 p-2 bg-black bg-opacity-10 rounded text-sm">
                <span className="font-mono">🔧 Tool: {(block.toolCall as any).name}</span>
              </div>
            )}
          </div>
        ))}
        <div
          className={`text-xs mt-1 ${
            isUser ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {new Date(timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
