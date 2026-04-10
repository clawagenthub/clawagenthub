'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import type { Project } from '@/lib/db/schema'

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description?: string; value?: string }) => Promise<void>
  project?: Project | null
}

export function ProjectModal({ isOpen, onClose, onSubmit, project }: ProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(project?.name || '')
      setDescription(project?.description || '')
      setValue(project?.value || '')
      setError(null)
    }
  }, [isOpen, project])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        value: value.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project ? 'Edit Project' : 'Create Project'}
      dismissible={!isSubmitting}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter project name..."
          maxLength={255}
          disabled={isSubmitting}
          required
        />

        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter project description..."
            maxLength={5000}
            disabled={isSubmitting}
            className="w-full px-3 py-2 rounded-lg border resize-none"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
            }}
            rows={3}
          />
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>
            {description.length}/5000 characters
          </p>
        </div>

        <Input
          label="Project Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g., high, medium, low, or a specific value..."
          maxLength={255}
          disabled={isSubmitting}
        />

        {error && (
          <p className="text-sm" style={{ color: 'rgb(239, 68, 68)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'rgb(var(--border-color))' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'rgb(var(--text-secondary))' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'rgb(var(--accent-primary, 59 130 246))', color: 'white' }}
          >
            {isSubmitting ? 'Saving...' : project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}