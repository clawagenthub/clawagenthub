'use client'

import React, { useState } from 'react'
import { Modal } from './modal'
import type { WorkspacePrompt } from '@/lib/query/hooks/useDefaultPrompts'

interface SelectPromptModalProps {
  isOpen: boolean
  onClose: () => void
  prompts: WorkspacePrompt[]
  onSelect: (promptContent: string) => void
}

export function SelectPromptModal({ isOpen, onClose, prompts, onSelect }: SelectPromptModalProps) {
  const [selectedPrompt, setSelectedPrompt] = useState<WorkspacePrompt | null>(null)
  const [editedValue, setEditedValue] = useState('')
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const handleSelect = (prompt: WorkspacePrompt) => {
    setSelectedPrompt(prompt)
    setEditedValue(prompt.value || '')
    setIsConfirmOpen(true)
  }

  const handleConfirm = () => {
    if (editedValue?.trim()) {
      onSelect(editedValue)
    }
    handleCloseAll()
  }

  const handleCloseAll = () => {
    setSelectedPrompt(null)
    setEditedValue('')
    setIsConfirmOpen(false)
    onClose()
  }

  if (prompts.length === 0) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Load Prompt" size="md">
        <div className="text-center py-8">
          <p className="text-lg mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
            No prompts available
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Go to Settings → Default Prompts to add prompts to your workspace.
          </p>
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
      </Modal>
    )
  }

  return (
    <>
      <Modal isOpen={isOpen && !isConfirmOpen} onClose={handleCloseAll} title="Load Prompt" size="lg">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Select a prompt to add to your ticket description. You can edit the content before adding.
          </p>

          <div
            className="max-h-96 overflow-y-auto border rounded-lg"
            style={{ borderColor: 'rgb(var(--border-color))' }}
          >
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="p-4 border-b last:border-b-0 cursor-pointer hover:bg-opacity-50 transition-colors"
                style={{ borderColor: 'rgb(var(--border-color))' }}
                onClick={() => handleSelect(prompt)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                        {prompt.name}
                      </p>
                      {prompt.isCustom && (
                        <span
                          className="px-1.5 py-0.5 text-xs rounded"
                          style={{
                            backgroundColor: 'rgb(var(--primary-color))',
                            color: 'white',
                          }}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {prompt.description}
                    </p>
                  </div>
                  <button
                    className="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                    style={{
                      backgroundColor: 'rgb(var(--primary-color))',
                      color: 'white',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelect(prompt)
                    }}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleCloseAll}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                color: 'rgb(var(--text-primary))',
                border: '1px solid rgb(var(--border-color))',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmOpen && selectedPrompt !== null}
        onClose={() => setIsConfirmOpen(false)}
        title={`Add: ${selectedPrompt?.name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Review and edit the prompt content below before adding to your ticket:
          </p>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
              Prompt Content (editable)
            </label>
            <textarea
              value={editedValue}
              onChange={(e) => setEditedValue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
              rows={12}
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                borderColor: 'rgb(var(--border-color))',
                color: 'rgb(var(--text-primary))',
              }}
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            <p className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
              Edit the content above to customize for this ticket
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  color: 'rgb(var(--text-primary))',
                  border: '1px solid rgb(var(--border-color))',
                }}
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={!editedValue?.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'rgb(var(--primary-color))',
                  color: 'white',
                }}
              >
                Add to Description
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
