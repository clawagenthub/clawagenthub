import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project, ProjectInsert, ProjectUpdate } from '@/lib/db/schema'

const PROJECTS_QUERY_KEY = 'projects'

async function fetchProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects')
  if (!response.ok) throw new Error('Failed to fetch projects')
  const data = await response.json()
  return data.projects
}

async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`)
  if (!response.ok) throw new Error('Failed to fetch project')
  const data = await response.json()
  return data.project
}

async function createProject(data: ProjectInsert): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create project' }))
    throw new Error(error.message)
  }
  const result = await response.json()
  return result.project
}

async function updateProject(data: ProjectUpdate & { id: string }): Promise<Project> {
  const { id, ...update } = data
  const response = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update project' }))
    throw new Error(error.message)
  }
  const result = await response.json()
  return result.project
}

async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete project' }))
    throw new Error(error.message)
  }
}

export function useProjects() {
  return useQuery({
    queryKey: [PROJECTS_QUERY_KEY],
    queryFn: fetchProjects,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [PROJECTS_QUERY_KEY, id],
    queryFn: () => fetchProject(id),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProject,
    onSuccess: (updatedProject) => {
      queryClient.setQueryData([PROJECTS_QUERY_KEY, updatedProject.id], updatedProject)
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] })
    },
  })
}