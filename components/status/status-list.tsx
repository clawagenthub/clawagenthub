'use client'

import React, { useState } from 'react'
import { StatusCard } from './status-card'
import { useReorderStatuses } from '@/lib/query/hooks/useStatuses'
import type { Status } from '@/lib/db/schema'

interface StatusListProps {
  statuses: Status[]
  onEdit: (status: Status) => void
  onDelete: (status: Status) => void
  canManage: boolean
}

export function StatusList({ statuses, onEdit, onDelete, canManage }: StatusListProps) {
  const [draggedStatusId, setDraggedStatusId] = useState<string | null>(null)
  const reorderStatuses = useReorderStatuses()

  const handleDragStart = (statusId: string) => {
    setDraggedStatusId(statusId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetStatusId: string) => {
    e.preventDefault()
    
    if (!draggedStatusId || draggedStatusId === targetStatusId) {
      setDraggedStatusId(null)
      return
    }

    const draggedIndex = statuses.findIndex((s) => s.id === draggedStatusId)
    const targetIndex = statuses.findIndex((s) => s.id === targetStatusId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedStatusId(null)
      return
    }

    // Create new array with reordered statuses
    const newStatuses = [...statuses]
    const [draggedStatus] = newStatuses.splice(draggedIndex, 1)
    newStatuses.splice(targetIndex, 0, draggedStatus)

    // Calculate new priorities based on position
    const reorderItems = newStatuses.map((status, index) => ({
      id: status.id,
      priority: index + 1,
    }))

    // Persist the new priorities to the database
    try {
      await reorderStatuses.mutateAsync(reorderItems)
    } catch (error) {
      console.error('Failed to reorder statuses:', error)
    }

    setDraggedStatusId(null)
  }

  if (statuses.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border py-12"
        style={{
          backgroundColor: `rgb(var(--bg-primary))`,
          borderColor: `rgb(var(--border-color))`,
        }}
      >
        <div className="mb-4 text-4xl">🏷️</div>
        <h3
          className="mb-2 text-lg font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          No statuses yet
        </h3>
        <p style={{ color: `rgb(var(--text-secondary))` }}>
          {canManage
            ? 'Create your first status to get started.'
            : 'Your workspace hasn\'t created any statuses yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 content-start">
      {statuses.map((status) => (
        <StatusCard
          key={status.id}
          status={status}
          onEdit={onEdit}
          onDelete={onDelete}
          canManage={canManage}
          draggable={canManage}
          onDragStart={() => handleDragStart(status.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status.id)}
          isDragging={draggedStatusId === status.id}
        />
      ))}
    </div>
  )
}
