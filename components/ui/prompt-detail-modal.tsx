'use client'

import React from 'react'
import { Modal } from './modal'

interface PromptDetailModalProps {
  isOpen: boolean
  onClose: () => void
  prompt: {
    id: string
    name: string
    description: string
    value: string
    isCustom: boolean
  } | null
}

export function PromptDetailModal({ isOpen, onClose, prompt }: PromptDetailModalProps) {
  if (!prompt) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={prompt.name}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
            Description
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            {prompt.description || 'No description provided'}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
            Type
          </p>
          <span
            className="px-2 py-1 text-xs rounded"
            style={{
              backgroundColor: prompt.isCustom ? 'rgb(var(--primary-color))' : 'rgb(var(--bg-secondary))',
              color: prompt.isCustom ? 'white' : 'rgb(var(--text-secondary))',
            }}
          >
            {prompt.isCustom ? 'Custom' : 'Default'}
          </span>
        </div>

        <div>
          <p className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
            Prompt Content
          </p>
          <pre
            className="p-3 rounded-lg border text-sm overflow-auto"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            {prompt.value}
          </pre>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              color: 'rgb(var(--text-primary))',
              border: '1px solid rgb(var(--border-color))',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
