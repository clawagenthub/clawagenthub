'use client'

import React from 'react'

interface TicketPromptSectionProps {
  description: string
  draftTicketId: string | null
  initialTicketId?: string
  isSubmitting: boolean
  isAutoPromptLoading: boolean
  promptCount: number
  onOpenPromptModal: () => void
  onAutoPromptLoadingChange: (loading: boolean) => void
  onDescriptionChange: (value: string) => void
  onUpdateDescription: (ticketId: string, description: string) => Promise<void>
}

export function TicketPromptSection({
  description,
  draftTicketId,
  initialTicketId,
  isSubmitting,
  isAutoPromptLoading,
  promptCount,
  onOpenPromptModal,
  onAutoPromptLoadingChange,
  onDescriptionChange,
  onUpdateDescription,
}: TicketPromptSectionProps) {
  const hasPrompts = promptCount > 0

  return (
    <div>
      <label
        className="mb-1 block text-sm font-medium"
        style={{ color: `rgb(var(--text-secondary))` }}
      >
        Quick Add Prompt
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenPromptModal}
          disabled={isSubmitting || !hasPrompts}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            color: 'rgb(var(--text-primary))',
            border: '1px solid rgb(var(--border-color))',
          }}
        >
          Load Prompt
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!description.trim()) {
              alert('Please enter some text in the description first.')
              return
            }
            if (!hasPrompts) {
              alert(
                'No prompts available. Add prompts in Settings → Default Prompts.'
              )
              return
            }

            onAutoPromptLoadingChange(true)
            try {
              const response = await fetch('/api/tickets/prompt-convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ticketId: draftTicketId || initialTicketId,
                  mode: 'auto',
                  targetText: description,
                }),
              })

              const data = await response.json().catch(() => null)
              if (!response.ok) {
                throw new Error(
                  data?.message || 'Failed to generate auto prompt'
                )
              }

              const convertedText = data?.convertedText
              if (!convertedText || typeof convertedText !== 'string') {
                throw new Error('Prompt converter returned empty text')
              }

              onDescriptionChange(convertedText)

              const activeTicketId = draftTicketId || initialTicketId
              if (activeTicketId) {
                await onUpdateDescription(activeTicketId, convertedText)
              }
            } catch (error) {
              alert(
                error instanceof Error
                  ? error.message
                  : 'Failed to generate auto prompt'
              )
            } finally {
              onAutoPromptLoadingChange(false)
            }
          }}
          disabled={isSubmitting || !hasPrompts || isAutoPromptLoading}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'rgb(var(--primary-color))',
            color: 'white',
          }}
        >
          {isAutoPromptLoading ? 'Auto Prompt...' : 'Auto Prompt'}
        </button>
      </div>

      {hasPrompts ? (
        <p
          className="mt-1 text-xs"
          style={{ color: 'rgb(var(--text-tertiary))' }}
        >
          {promptCount} prompt{promptCount !== 1 ? 's' : ''} available
        </p>
      ) : (
        <p
          className="mt-1 text-xs"
          style={{ color: 'rgb(var(--text-tertiary))' }}
        >
          No prompts available. Add prompts in Settings → Default Prompts.
        </p>
      )}
    </div>
  )
}
