'use client'

import React, { useState } from 'react'
import { TextAreaWithImage, type ComposerAttachment } from '@/components/ui/text-area-with-image'

interface ChatInputProps {
  onSend: (content: string, attachments?: ComposerAttachment[]) => void
  disabled?: boolean
  placeholder?: string
  isConnected?: boolean
  isTyping?: boolean
  maxImages?: number
  allowPdf?: boolean
  agentSupportsImages?: boolean
}

export function ChatInput({ onSend, disabled, placeholder, isConnected = true, isTyping, maxImages = 5, allowPdf = true, agentSupportsImages = true }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [charCount, setCharCount] = useState(0)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if ((trimmed || attachments.length > 0) && !disabled) {
      if (attachments.length > 0 && !agentSupportsImages) {
        alert('The selected agent does not support image recognition. Remove attachments or choose a vision-capable agent.')
        return
      }
      onSend(trimmed, attachments)
      setValue('')
      setAttachments([])
      setCharCount(0)
    }
  }

  const getDisabledMessage = () => {
    if (!isConnected) return 'Connecting to gateway...'
    if (isTyping) return 'Agent is working...'
    return ''
  }

  return (
    <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'rgb(var(--border-color))' }}>
      <div className="max-w-4xl mx-auto">
        {disabled && getDisabledMessage() && (
          <div className="text-xs text-center mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            {getDisabledMessage()}
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <TextAreaWithImage
              value={value}
              onChange={(nextValue) => {
                setValue(nextValue)
                setCharCount(nextValue.length)
              }}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              disabled={disabled}
              placeholder={placeholder || 'Type your message...'}
              maxImages={maxImages}
              maxFiles={maxImages}
              allowPdf={allowPdf}
              onSubmit={handleSubmit}
            />

            {charCount > 0 && (
              <div className="absolute bottom-8 right-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                {charCount.toLocaleString()}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={disabled || (!value.trim() && attachments.length === 0)}
            className={`p-3 rounded-lg transition-all flex-shrink-0 ${
              disabled || (!value.trim() && attachments.length === 0) ? 'opacity-50' : 'hover:scale-105'
            }`}
            style={{
              backgroundColor: (!disabled && (value.trim() || attachments.length > 0)) ? 'rgb(var(--primary-color, 59 130 246))' : 'rgb(var(--bg-secondary))',
              color: (!disabled && (value.trim() || attachments.length > 0)) ? 'white' : 'rgb(var(--text-secondary))'
            }}
            title="Send message (Enter)"
          >
            {isTyping ? '⟳' : '➤'}
          </button>
        </div>

        <div className="text-xs mt-2 text-center" style={{ color: 'rgb(var(--text-secondary), 0.6)' }}>
          Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Enter</kbd> to send,
          <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ml-1">Shift + Enter</kbd> for new line
          {!agentSupportsImages ? ' • current agent has no image recognition' : ''}
        </div>
      </div>
    </div>
  )
}
