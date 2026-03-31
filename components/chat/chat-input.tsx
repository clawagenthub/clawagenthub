'use client'

import React, { useState, useRef, useEffect } from 'react'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 200)
      textarea.style.height = `${newHeight}px`
    }
  }, [value])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'rgb(var(--border-color))' }}>
      <div className="max-w-4xl mx-auto">
        <div className={`flex items-end gap-3 transition-all ${
          isFocused ? 'scale-[1.01]' : ''
        }`}>
          {/* Attachment Button */}
          <button
            className="p-3 rounded-lg transition-all hover:scale-105 flex-shrink-0"
            style={{ 
              backgroundColor: 'rgb(var(--bg-secondary))',
              color: disabled ? 'rgb(var(--text-secondary), 0.5)' : 'rgb(var(--text-secondary))',
              cursor: disabled ? 'not-allowed' : 'pointer'
            }}
            disabled={disabled}
            title="Attach files (coming soon)"
          >
            📎
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              placeholder={placeholder || 'Type your message...'}
              className={`w-full px-4 py-3 rounded-lg resize-none transition-all ${
                disabled ? 'opacity-50' : ''
              } ${isFocused ? 'ring-2 ring-blue-500/20' : ''}`}
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                border: '1px solid rgb(var(--border-color))',
                color: 'rgb(var(--text-primary))',
                maxHeight: '200px',
                minHeight: '48px'
              }}
              rows={1}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={`p-3 rounded-lg transition-all flex-shrink-0 ${
              disabled || !value.trim() ? 'opacity-50' : 'hover:scale-105 active:scale-95'
            }`}
            style={{
              backgroundColor: (!disabled && value.trim()) ? 'rgb(var(--primary-color, 59 130 246))' : 'rgb(var(--bg-secondary))',
              color: (!disabled && value.trim()) ? 'white' : 'rgb(var(--text-secondary))'
            }}
            title="Send message (Enter)"
          >
            {value.trim() ? '➤' : '✤'}
          </button>
        </div>

        {/* Hint Text */}
        <div className="text-xs mt-2 text-center" style={{ color: 'rgb(var(--text-secondary), 0.6)' }}>
          Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 mx-0.5">Enter</kbd> to send, 
          <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 mx-0.5">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  )
}
