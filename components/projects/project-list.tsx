'use client'

import React, { useState } from 'react'
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/lib/query/hooks'
import { ProjectModal } from './project-modal'
import type { Project } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

interface ProjectListProps {
  onProjectSelect?: (project: Project) => void
  selectable?: boolean
}

export function ProjectList({ onProjectSelect, selectable = false }: ProjectListProps) {
  const { data: projects, isLoading, error } = useProjects()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const handleCreate = () => {
    setEditingProject(null)
    setIsModalOpen(true)
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setIsModalOpen(true)
  }

  const handleDelete = async (project: Project) => {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
      return
    }
    try {
      await deleteProject.mutateAsync(project.id)
      logger.info('[ProjectList] Deleted project:', project.id)
    } catch (error) {
      logger.error('[ProjectList] Failed to delete project:', error)
      alert('Failed to delete project')
    }
  }

  const handleSubmit = async (data: { name: string; description?: string; value?: string }) => {
    try {
      if (editingProject) {
        await updateProject.mutateAsync({ id: editingProject.id, ...data })
        logger.info('[ProjectList] Updated project:', editingProject.id)
      } else {
        await createProject.mutateAsync(data)
        logger.info('[ProjectList] Created project')
      }
      setIsModalOpen(false)
    } catch (error) {
      logger.error('[ProjectList] Failed to save project:', error)
      throw error
    }
  }

  if (isLoading) {
    return <div className="p-4 text-center" style={{ color: 'rgb(var(--text-secondary))' }}>Loading projects...</div>
  }

  if (error) {
    return <div className="p-4 text-center" style={{ color: 'rgb(var(--text-error, 239 68 68)' }}>Failed to load projects</div>
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Projects</h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: 'rgb(var(--accent-primary, 59 130 246))', color: 'white' }}
        >
          + New Project
        </button>
      </div>

      {!projects?.length ? (
        <div className="text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`p-4 rounded-lg border transition-colors ${
                selectable ? 'cursor-pointer hover:border-blue-500' : ''
              }`}
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                borderColor: 'rgb(var(--border-color))'
              }}
              onClick={() => selectable && onProjectSelect?.(project)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{project.name}</h3>
                  {project.description && (
                    <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {project.description}
                    </p>
                  )}
                  {project.value && (
                    <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Value: {project.value}
                    </p>
                  )}
                </div>
                {!selectable && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(project)}
                      className="px-3 py-1 text-xs rounded-md transition-colors"
                      style={{ backgroundColor: 'rgb(var(--bg-tertiary))', color: 'rgb(var(--text-primary))' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(project)}
                      className="px-3 py-1 text-xs rounded-md transition-colors"
                      style={{ backgroundColor: 'rgb(239, 68, 68)', color: 'white' }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        project={editingProject}
      />
    </div>
  )
}