'use client'

import React, { useState } from 'react'
import {
  TextAreaWithImage,
  type ComposerAttachment,
} from '@/components/ui/text-area-with-image'

interface ChatInputProps {
  onSend: (content: string, attachments?: ComposerAttachment[]) => void
  disabled?: boolean
  placeholder?: string
  maxImages?: number
  allowPdf?: boolean
  agentSupportsImages?: boolean
}

export function ChatInput({
  onSend,
  disabled,
  placeholder,
  maxImages = 5,
  allowPdf = true,
  agentSupportsImages = true,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if ((trimmed || attachments.length > 0) && !disabled) {
      // Removed hard block: allow image attachments even when agent capability is false.
      // If the agent is non-vision, it will process the attachments textually or reject them.
      onSend(trimmed, attachments)
      setValue('')
      setAttachments([])
    }
  }

  return (
    <div
      className="flex-shrink-0 border-t p-4"
      style={{ borderColor: 'rgb(var(--border-color))' }}
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <TextAreaWithImage
              value={value}
              onChange={setValue}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              disabled={disabled}
              placeholder={placeholder || 'Type your message...'}
              maxImages={maxImages}
              maxFiles={maxImages}
              allowPdf={allowPdf}
              onSubmit={handleSubmit}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={disabled || (!value.trim() && attachments.length === 0)}
            className={`flex-shrink-0 rounded-lg p-3 transition-all ${
              disabled || (!value.trim() && attachments.length === 0)
                ? 'opacity-50'
                : 'hover:scale-105 active:scale-95'
            }`}
            style={{
              backgroundColor:
                !disabled && (value.trim() || attachments.length > 0)
                  ? 'rgb(var(--primary-color, 59 130 246))'
                  : 'rgb(var(--bg-secondary))',
              color:
                !disabled && (value.trim() || attachments.length > 0)
                  ? 'white'
                  : 'rgb(var(--text-secondary))',
            }}
            title="Send message (Enter)"
          >
            {value.trim() || attachments.length > 0 ? '➤' : '✤'}
          </button>
        </div>

        <div
          className="mt-2 text-center text-xs"
          style={{ color: 'rgb(var(--text-secondary), 0.6)' }}
        >
          Press{' '}
          <kbd className="mx-0.5 rounded bg-gray-200 px-1.5 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            Enter
          </kbd>{' '}
          to send,
          <kbd className="mx-0.5 rounded bg-gray-200 px-1.5 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            Shift + Enter
          </kbd>{' '}
          for new line
          {!agentSupportsImages
            ? ' • current agent has no image recognition'
            : ''}
        </div>
      </div>
    </div>
  )
}
