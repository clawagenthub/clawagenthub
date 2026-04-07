import { Skill } from './types'

interface SkillModalProps {
  skill: Skill | null
  onSave: (data: any) => void
  onClose: () => void
}

export function SkillModal({ skill, onSave, onClose }: SkillModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg shadow-lg"
        style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
      >
        <div className="p-6">
          <h2
            className="mb-4 text-xl font-bold"
            style={{ color: 'rgb(var(--text-primary))' }}
          >
            {skill ? 'Edit Skill' : 'Add New Skill'}
          </h2>
          <SkillFormInternal skill={skill} onSave={onSave} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'

interface SkillFormInternalProps {
  skill: Skill | null
  onSave: (data: any) => void
  onCancel: () => void
}

export function SkillFormInternal({
  skill,
  onSave,
  onCancel,
}: SkillFormInternalProps) {
  const [formData, setFormData] = useState({
    skill_name: skill?.skill_name || '',
    skill_description: skill?.skill_description || '',
    skill_data: skill?.skill_data || '',
    tags: skill?.tags || '',
  })

  useEffect(() => {
    if (skill) {
      setFormData({
        skill_name: skill.skill_name || '',
        skill_description: skill.skill_description || '',
        skill_data: skill.skill_data || '',
        tags: skill.tags || '',
      })
    }
  }, [skill])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.skill_name.trim() || !formData.skill_data.trim()) {
      alert('Name and content are required')
      return
    }
    onSave(formData)
  }

  const inputStyle = {
    backgroundColor: 'rgb(var(--bg-secondary))',
    borderColor: 'rgb(var(--border-color))',
    color: 'rgb(var(--text-primary))',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          className="mb-1 block font-medium"
          style={{ color: 'rgb(var(--text-primary))' }}
        >
          Skill Name *
        </label>
        <input
          type="text"
          value={formData.skill_name}
          onChange={(e) =>
            setFormData({ ...formData, skill_name: e.target.value })
          }
          className="w-full rounded-lg border px-3 py-2"
          style={inputStyle}
          placeholder="e.g., React Best Practices"
        />
      </div>
      <div>
        <label
          className="mb-1 block font-medium"
          style={{ color: 'rgb(var(--text-primary))' }}
        >
          Description
        </label>
        <input
          type="text"
          value={formData.skill_description}
          onChange={(e) =>
            setFormData({ ...formData, skill_description: e.target.value })
          }
          className="w-full rounded-lg border px-3 py-2"
          style={inputStyle}
          placeholder="Brief description of what this skill does"
        />
      </div>
      <div>
        <label
          className="mb-1 block font-medium"
          style={{ color: 'rgb(var(--text-primary))' }}
        >
          Content (Markdown) *
        </label>
        <textarea
          value={formData.skill_data}
          onChange={(e) =>
            setFormData({ ...formData, skill_data: e.target.value })
          }
          className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
          style={{ ...inputStyle, minHeight: '300px', fontFamily: 'monospace' }}
          placeholder="# Your Skill Name&#10;&#10;## Overview&#10;Brief description of what this skill does.&#10;&#10;## Instructions&#10;Step-by-step instructions for the AI agent..."
        />
      </div>
      <div>
        <label
          className="mb-1 block font-medium"
          style={{ color: 'rgb(var(--text-primary))' }}
        >
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          className="w-full rounded-lg border px-3 py-2"
          style={inputStyle}
          placeholder="react, frontend, best-practices"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-4 py-2"
          style={inputStyle}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          {skill ? 'Update' : 'Create'} Skill
        </button>
      </div>
    </form>
  )
}
