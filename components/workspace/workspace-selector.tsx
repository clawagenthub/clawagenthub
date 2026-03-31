'use client'

import React, { useState, useEffect } from 'react'
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { WorkspaceWithRole } from '@/lib/db/schema'

interface WorkspaceSelectorProps {
  currentWorkspace: WorkspaceWithRole | null
  workspaces: WorkspaceWithRole[]
  onWorkspaceChange: (workspaceId: string) => void
  onWorkspaceCreated: () => void
}

export function WorkspaceSelector({
  currentWorkspace,
  workspaces,
  onWorkspaceChange,
  onWorkspaceCreated,
}: WorkspaceSelectorProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      setError('Workspace name is required')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const response = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      })

      if (response.ok) {
        setNewWorkspaceName('')
        setIsCreateModalOpen(false)
        onWorkspaceCreated()
      } else {
        const data = await response.json()
        setError(data.message || 'Failed to create workspace')
      }
    } catch (err) {
      setError('An error occurred while creating the workspace')
    } finally {
      setIsCreating(false)
    }
  }

  const dropdownItems: DropdownItem[] = [
    ...workspaces.map((workspace) => ({
      label: workspace.name,
      icon: workspace.id === currentWorkspace?.id ? '✓' : '🏢',
      onClick: () => onWorkspaceChange(workspace.id),
    })),
    {
      label: '',
      icon: null,
      onClick: () => {},
      divider: true,
    },
    {
      label: 'Create New Workspace',
      icon: '➕',
      onClick: () => setIsCreateModalOpen(true),
    },
  ]

  return (
    <>
      <Dropdown
        trigger={
          <div
            className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
            style={{
              backgroundColor: `rgb(var(--bg-primary))`,
              borderColor: `rgb(var(--border-color))`,
            }}
          >
            <div className="flex items-center">
              <span className="mr-2 text-lg">🏢</span>
              <span
                className="font-medium"
                style={{ color: `rgb(var(--text-primary))` }}
              >
                {currentWorkspace?.name || 'Select Workspace'}
              </span>
            </div>
            <svg
              className="h-5 w-5"
              style={{ color: `rgb(var(--text-tertiary))` }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        }
        items={dropdownItems}
        align="left"
      />

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setNewWorkspaceName('')
          setError('')
        }}
        title="Create New Workspace"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="workspace-name"
              className="block text-sm font-medium mb-2"
              style={{ color: `rgb(var(--text-secondary))` }}
            >
              Workspace Name
            </label>
            <Input
              id="workspace-name"
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Enter workspace name"
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreateWorkspace()
                }
              }}
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false)
                setNewWorkspaceName('')
                setError('')
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              loading={isCreating}
              disabled={isCreating || !newWorkspaceName.trim()}
            >
              Create Workspace
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
