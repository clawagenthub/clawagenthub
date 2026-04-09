'use client'

import React from 'react'
import type { ChatSession } from '@/lib/db/schema'
import { useChatHeader } from './hooks/useChatHeader'
import { useGatewayConnection } from '@/lib/hooks/useGatewayService'
import { useSessionIdle } from '@/lib/hooks/useSessionIdle'

interface ChatHeaderProps {
  session: ChatSession
  isStreaming: boolean
  generateSummary: any
}

export function ChatHeader({ session, isStreaming, generateSummary }: ChatHeaderProps) {
  const { isConnected: isGatewayConnected } = useGatewayConnection()
  const { isGenerating: sessionIsGenerating } = useSessionIdle({
    sessionId: session.id,
    sessionStatus: session.status,
    enabled: true,
  })

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
    handleSummarize,
  } = useChatHeader({ session })

  return (
    <div
      className="flex flex-shrink-0 items-center justify-between border-b px-6 py-4"
      style={{ borderColor: 'rgb(var(--border-color))' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white">
          {session.agent_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
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
              <button onClick={handleTitleSave} className="rounded bg-green-100 p-1 text-green-600 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50" title="Save (Enter)">✓</button>
              <button onClick={handleTitleCancel} className="rounded bg-red-100 p-1 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50" title="Cancel (Esc)">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{session.title || 'New Chat'}</h2>
              <button onClick={handleTitleClick} className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:bg-gray-100 hover:opacity-100 dark:hover:bg-gray-800" title="Edit title and description">✏️</button>
            </div>
          )}

          <p className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            <span>🤖 {session.agent_name}</span>
            {isGatewayConnected ? (
              <span className="text-xs text-green-600 dark:text-green-400">● Live</span>
            ) : (
              <span className="text-xs text-red-600 dark:text-red-400">● Offline</span>
            )}
          </p>

          {isEditingDescription ? (
            <div className="mt-2 flex items-start gap-2">
              <textarea
                ref={descriptionInputRef}
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onKeyDown={handleDescriptionKeyDown}
                className="flex-1 resize-none overflow-hidden border-b-2 border-blue-500 bg-transparent text-sm outline-none"
                style={{ color: 'rgb(var(--text-primary))', minHeight: '24px', maxHeight: '80px' }}
                rows={1}
                placeholder="Add a description..."
              />
              <button onClick={handleDescriptionSave} className="rounded bg-green-100 p-1 text-green-600 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50" title="Save (Enter)">✓</button>
              <button onClick={handleDescriptionCancel} className="rounded bg-red-100 p-1 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50" title="Cancel (Esc)">✕</button>
            </div>
          ) : (
            <div className="mt-1 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {descriptionText ? (
                  hasLongDescription ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer opacity-85 transition-opacity hover:opacity-100" style={{ color: 'rgb(var(--text-secondary))' }}>{descriptionPreview}</summary>
                      <p className="mt-2 whitespace-pre-wrap break-words" style={{ color: 'rgb(var(--text-secondary))' }}>{descriptionText}</p>
                    </details>
                  ) : (
                    <p className="truncate text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{descriptionText}</p>
                  )
                ) : (
                  <p className="truncate text-sm" style={{ color: 'rgb(var(--text-tertiary))', fontStyle: 'italic' }}>Add a description...</p>
                )}
              </div>
              <button onClick={handleDescriptionClick} className="rounded p-1 text-gray-400 opacity-60 transition-opacity hover:bg-gray-100 hover:opacity-100 dark:hover:bg-gray-800" title="Edit description">✏️</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {sessionIsGenerating && (
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
          ) : '📝 Summarize'}
        </button>
      </div>
    </div>
  )
}