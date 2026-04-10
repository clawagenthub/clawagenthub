'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { WorkspaceSelector } from '@/components/workspace/workspace-selector'
import { SidebarNav } from './sidebar-nav'
import { SidebarUserMenu } from './sidebar-user-menu'
import type { WorkspaceWithRole } from '@/lib/db/schema'
import logger from '@/lib/logger/index.js'
import {
  useOnMount,
  useOnDestroy,
  useOnChange,
} from '@/lib/hooks/use-lifecycle'

// Global mount guard: prevents multiple Sidebar instances from triggering simultaneous workspace fetches.
// This is a safety net against React StrictMode double-invocation and any parent remount loops.
let globalSidebarMountCount = 0
const GLOBAL_MOUNT_GUARD_ENABLED = true

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
  const routerRef = useRef(router)
  const currentWorkspaceRef = useRef<WorkspaceWithRole | null>(null)
  const isInitialLoadRef = useRef(true)
  const switchingWorkspaceRef = useRef(false)
  const isFetchingWorkspacesRef = useRef(false)

  useOnChange(router, (nextRouter) => {
    routerRef.current = nextRouter
  })

  useOnChange(currentWorkspace, (nextWorkspace, prevWorkspace) => {
    currentWorkspaceRef.current = nextWorkspace
    logger.debug('[SidebarLoopDebug] currentWorkspace changed', {
      prevId: prevWorkspace?.id ?? null,
      nextId: nextWorkspace?.id ?? null,
    })
  })

  useOnChange(isInitialLoad, (next, prev) => {
    isInitialLoadRef.current = next
    logger.debug('[SidebarLoopDebug] isInitialLoad changed', {
      prev,
      next,
    })
  })

  useOnChange(switchingWorkspace, (next, prev) => {
    switchingWorkspaceRef.current = next
    logger.debug('[SidebarLoopDebug] switchingWorkspace changed', {
      prev,
      next,
    })
  })

  const handleWorkspaceChange = useCallback(async (workspaceId: string) => {
    if (currentWorkspaceRef.current?.id === workspaceId) return

    try {
      logger.debug('[SidebarLoopDebug] handleWorkspaceChange called', {
        workspaceId,
        currentWorkspaceId: currentWorkspaceRef.current?.id ?? null,
        isInitialLoad: isInitialLoadRef.current,
      })

      const response = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentWorkspace(data.workspace)
        setSwitchingWorkspace(false)
        if (!isInitialLoadRef.current) {
          routerRef.current.refresh()
        }
      }
    } catch (error) {
      logger.error('Error switching workspace:', error)
      setSwitchingWorkspace(false)
    }
  }, [])

  const fetchWorkspaces = useCallback(async () => {
    // Loop guard: if a previous workspace fetch is still in flight, skip this run.
    if (isFetchingWorkspacesRef.current) {
      logger.debug(
        '[SidebarLoopDebug] fetchWorkspaces skipped (already in flight)',
        {
          currentWorkspaceId: currentWorkspaceRef.current?.id ?? null,
        }
      )
      return
    }

    // Loop guard: skip if not initial load anymore (prevents re-trigger on state changes)
    if (!isInitialLoadRef.current) {
      logger.debug(
        '[SidebarLoopDebug] fetchWorkspaces skipped (not initial load)',
        {
          currentWorkspaceId: currentWorkspaceRef.current?.id ?? null,
        }
      )
      return
    }

    isFetchingWorkspacesRef.current = true

    try {
      logger.debug('[SidebarLoopDebug] fetchWorkspaces start', {
        isInitialLoad: isInitialLoadRef.current,
        switchingWorkspace: switchingWorkspaceRef.current,
        currentWorkspaceId: currentWorkspaceRef.current?.id ?? null,
      })

      const response = await fetch('/api/workspaces')
      if (response.ok) {
        const data = await response.json()
        setWorkspaces(data.workspaces)

        const currentResponse = await fetch('/api/workspaces/current')
        if (currentResponse.ok) {
          const currentData = await currentResponse.json()
          logger.debug('[SidebarLoopDebug] current workspace API result', {
            workspaceId: currentData.workspace?.id ?? null,
            workspaceCount: data.workspaces.length,
          })

          setCurrentWorkspace((prev) => {
            const prevId = prev?.id ?? null
            const nextId = currentData.workspace?.id ?? null
            return prevId === nextId ? prev : currentData.workspace
          })

          if (
            !currentData.workspace &&
            data.workspaces.length > 0 &&
            isInitialLoadRef.current &&
            !switchingWorkspaceRef.current
          ) {
            // Prevent loop: auto-switch runs only during initial load before workspace exists.
            logger.debug(
              '[SidebarLoopDebug] auto-switch first workspace triggered',
              {
                targetWorkspaceId: data.workspaces[0].id,
              }
            )
            setSwitchingWorkspace(true)
            await handleWorkspaceChange(data.workspaces[0].id)
          }
        }
      }
    } catch (error) {
      logger.error(
        '[SidebarLoopDebug] Error fetching workspaces: %s',
        String(error)
      )
    } finally {
      logger.debug('[SidebarLoopDebug] fetchWorkspaces finish', {})
      isFetchingWorkspacesRef.current = false
      setLoading(false)
      setIsInitialLoad(false)
    }
  }, [handleWorkspaceChange])

  useOnMount(() => {
    globalSidebarMountCount++
    const instanceId = globalSidebarMountCount

    logger.debug('[SidebarLoopDebug] Sidebar mounted', {
      instanceId,
      totalMounts: globalSidebarMountCount,
      currentWorkspaceId: currentWorkspaceRef.current?.id ?? null,
      isInitialLoad: isInitialLoadRef.current,
      switchingWorkspace: switchingWorkspaceRef.current,
    })

    // Global guard: if another instance mounted after us, skip the fetch.
    // This handles StrictMode double-invocation and parent remount loops.
    if (GLOBAL_MOUNT_GUARD_ENABLED && instanceId > 1) {
      logger.debug(
        '[SidebarLoopDebug] Skipping fetchWorkspaces - another Sidebar instance already mounted',
        { instanceId, totalMounts: globalSidebarMountCount }
      )
      return
    }

    fetchWorkspaces()
  })

  useOnDestroy(() => {
    globalSidebarMountCount--
    logger.debug('[SidebarLoopDebug] Sidebar unmounted', {
      remainingMounts: globalSidebarMountCount,
      currentWorkspaceId: currentWorkspaceRef.current?.id ?? null,
      isInitialLoad: isInitialLoadRef.current,
      switchingWorkspace: switchingWorkspaceRef.current,
    })
  })

  const handleWorkspaceCreated = useCallback(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

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
