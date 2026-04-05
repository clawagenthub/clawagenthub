'use client'

import React, { useState } from 'react'
import { Modal } from './modal'
import { DEFAULT_PROMPTS } from '@/lib/utils/default-prompts'
import type { WorkspacePrompt } from '@/lib/query/hooks/useDefaultPrompts'

interface LoadDefaultPromptsModalProps {
  isOpen: boolean
  onClose: () => void
  onLoad: (prompts: WorkspacePrompt[]) => void
  existingPromptIds: string[]
}

export function LoadDefaultPromptsModal({ isOpen, onClose, onLoad, existingPromptIds }: LoadDefaultPromptsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    const availableIds = DEFAULT_PROMPTS
      .map((p) => p.id)
      .filter((id) => !existingPromptIds.includes(id))
    setSelectedIds(availableIds)
  }

  const handleDeselectAll = () => {
    setSelectedIds([])
  }

  const handleLoad = () => {
    const promptsToAdd = DEFAULT_PROMPTS
      .filter((p) => selectedIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        value: p.value,
        isCustom: false,
      })) as WorkspacePrompt[]
    onLoad(promptsToAdd)
    setSelectedIds([])
    onClose()
  }

  const handleClose = () => {
    setSelectedIds([])
    onClose()
  }

  const availablePrompts = DEFAULT_PROMPTS.filter((p) => !existingPromptIds.includes(p.id))

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Load Default Prompts" size="lg">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
          Select prompts to add to your workspace. Already added prompts are hidden.
        </p>

        {availablePrompts.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>
            All default prompts have already been added.
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  color: 'rgb(var(--text-primary))',
                  border: '1px solid rgb(var(--border-color))',
                }}
              >
                Select All Available
              </button>
              <button
                onClick={handleDeselectAll}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  color: 'rgb(var(--text-primary))',
                  border: '1px solid rgb(var(--border-color))',
                }}
              >
                Deselect All
              </button>
            </div>

            <div
              className="max-h-80 overflow-y-auto border rounded-lg"
              style={{ borderColor: 'rgb(var(--border-color))' }}
            >
              {availablePrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-start gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-opacity-50"
                  style={{ borderColor: 'rgb(var(--border-color))' }}
                  onClick={() => handleToggle(prompt.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(prompt.id)}
                    onChange={() => handleToggle(prompt.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                      {prompt.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {prompt.description.length > 100
                        ? `${prompt.description.substring(0, 100)}...`
                        : prompt.description}
                    </p>
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer" style={{ color: 'rgb(var(--primary-color))' }}>
                        Preview prompt
                      </summary>
                      <pre
                        className="mt-1 p-2 rounded text-xs overflow-auto"
                        style={{
                          backgroundColor: 'rgb(var(--bg-secondary))',
                          color: 'rgb(var(--text-secondary))',
                        }}
                      >
                        {prompt.value}
                      </pre>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-between items-center pt-2">
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            {selectedIds.length} prompt{selectedIds.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                color: 'rgb(var(--text-primary))',
                border: '1px solid rgb(var(--border-color))',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleLoad}
              disabled={selectedIds.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'rgb(var(--primary-color))',
                color: 'white',
              }}
            >
              Add Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
