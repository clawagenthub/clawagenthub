'use client'

import React, { useState, useRef, useEffect } from 'react'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  isConnected?: boolean
  isTyping?: boolean
}

export function ChatInput({ onSend, disabled, placeholder, isConnected = true, isTyping }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [charCount, setCharCount] = useState(0)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [value])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
      setCharCount(0)
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

  const getDisabledMessage = () => {
    if (!isConnected) return 'Connecting to gateway...'
    if (isTyping) return 'Agent is working...'
    return ''
  }

  return (
    <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'rgb(var(--border-color))' }}>
      <div className="max-w-4xl mx-auto">
        {/* Disabled message */}
        {disabled && getDisabledMessage() && (
          <div className="text-xs text-center mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            {getDisabledMessage()}
          </div>
        )}

        <div className="flex items-end gap-3">
          {/* Attachment Button */}
          <button
            className="p-3 rounded-lg transition-colors flex-shrink-0"
            style={{ 
              backgroundColor: 'rgb(var(--bg-secondary))',
              color: disabled ? 'rgb(var(--text-secondary), 0.5)' : 'rgb(var(--text-secondary))'
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
              onChange={(e) => {
                setValue(e.target.value)
                setCharCount(e.target.value.length)
              }}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder || 'Type your message...'}
              className={`w-full px-4 py-3 rounded-lg resize-none transition-all ${
                disabled ? 'opacity-50' : ''
              }`}
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                border: '1px solid rgb(var(--border-color))',
                color: 'rgb(var(--text-primary))',
                maxHeight: '200px',
                minHeight: '48px'
              }}
              rows={1}
            />
            
            {/* Character Count */}
            {charCount > 0 && (
              <div className="absolute bottom-2 right-2 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                {charCount.toLocaleString()}
              </div>
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={`p-3 rounded-lg transition-all flex-shrink-0 ${
              disabled || !value.trim() ? 'opacity-50' : 'hover:scale-105'
            }`}
            style={{
              backgroundColor: (!disabled && value.trim()) ? 'rgb(var(--primary-color, 59 130 246))' : 'rgb(var(--bg-secondary))',
              color: (!disabled && value.trim()) ? 'white' : 'rgb(var(--text-secondary))'
            }}
            title="Send message (Enter)"
          >
            {isTyping ? '⟳' : '➤'}
          </button>
        </div>

        {/* Hint Text */}
        <div className="text-xs mt-2 text-center" style={{ color: 'rgb(var(--text-secondary), 0.6)' }}>
          Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Enter</kbd> to send, 
          <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ml-1">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  )
}
