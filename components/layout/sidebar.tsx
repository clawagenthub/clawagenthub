'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WorkspaceSelector } from '@/components/workspace/workspace-selector'
import { SidebarNav } from './sidebar-nav'
import { SidebarUserMenu } from './sidebar-user-menu'
import type { WorkspaceWithRole } from '@/lib/db/schema'
import logger, { logCategories } from '@/lib/logger/index.js'


interface UserInfo {
  id: string
  email: string
  is_superuser: boolean
}

interface SidebarProps {
  user: UserInfo
}

export function Sidebar({ user: _user }: SidebarProps) {
  const router = useRouter()
  const [currentWorkspace, setCurrentWorkspace] =
    useState<WorkspaceWithRole | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false)

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces')
      if (response.ok) {
        const data = await response.json()
        setWorkspaces(data.workspaces)

        const currentResponse = await fetch('/api/workspaces/current')
        if (currentResponse.ok) {
          const currentData = await currentResponse.json()
          setCurrentWorkspace(currentData.workspace)

          if (
            !currentData.workspace &&
            data.workspaces.length > 0 &&
            isInitialLoad &&
            !switchingWorkspace
          ) {
            setSwitchingWorkspace(true)
            await handleWorkspaceChange(data.workspaces[0].id)
          }
        }
      }
    } catch (error) {
      logger.error('Error fetching workspaces:', error)
    } finally {
      setLoading(false)
      setIsInitialLoad(false)
    }
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const handleWorkspaceChange = async (workspaceId: string) => {
    if (currentWorkspace?.id === workspaceId) return

    try {
      const response = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentWorkspace(data.workspace)
        setSwitchingWorkspace(false)
        if (!isInitialLoad) {
          router.refresh()
        }
      }
    } catch (error) {
      logger.error('Error switching workspace:', error)
      setSwitchingWorkspace(false)
    }
  }

  const handleWorkspaceCreated = () => {
    fetchWorkspaces()
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      logger.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <aside
        className="w-64 border-r p-4"
        style={{
          backgroundColor: `rgb(var(--sidebar-bg))`,
          borderColor: `rgb(var(--border-color))`,
        }}
      >
        <div className="animate-pulse">
          <div
            className="mb-4 h-12 rounded"
            style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}
          />
          <div
            className="mb-2 h-8 rounded"
            style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}
          />
          <div
            className="h-8 rounded"
            style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}
          />
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="flex w-64 flex-col border-r"
      style={{
        backgroundColor: `rgb(var(--sidebar-bg))`,
        borderColor: `rgb(var(--border-color))`,
      }}
    >
      <div
        className="border-b p-4"
        style={{ borderColor: `rgb(var(--border-color))` }}
      >
        <WorkspaceSelector
          currentWorkspace={currentWorkspace}
          workspaces={workspaces}
          onWorkspaceChange={handleWorkspaceChange}
          onWorkspaceCreated={handleWorkspaceCreated}
        />
      </div>

      <SidebarNav />
      <SidebarUserMenu onLogout={handleLogout} />
    </aside>
  )
}
