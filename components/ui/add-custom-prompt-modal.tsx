'use client'

import React, { useState } from 'react'
import { Modal } from './modal'

interface AddCustomPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (prompt: {
    name: string
    description: string
    value: string
  }) => void
}

export function AddCustomPromptModal({ isOpen, onClose, onAdd }: AddCustomPromptModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    if (!name.trim() || !value.trim()) return

    onAdd({
      name: name.trim(),
      description: description.trim(),
      value: value.trim(),
    })

    // Reset form
    setName('')
    setDescription('')
    setValue('')
    onClose()
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setValue('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Custom Prompt" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
            }}
            placeholder="e.g., My Custom Prompt Framework"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            rows={2}
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
            }}
            placeholder="Brief description of when to use this prompt..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
            Prompt Content *
          </label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
            rows={8}
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
            }}
            placeholder={`**Role:** [Who the AI should act as]
**Task:** [The specific action you want performed]
**Format:** [How the output should be structured]`}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
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
            onClick={handleSubmit}
            disabled={!name.trim() || !value.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'rgb(var(--primary-color))',
              color: 'white',
            }}
          >
            Add Prompt
          </button>
        </div>
      </div>
    </Modal>
  )
}
