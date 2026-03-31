'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WorkspaceSelector } from '@/components/workspace/workspace-selector'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { useNavigation } from '@/lib/contexts/navigation-context'
import type { WorkspaceWithRole } from '@/lib/db/schema'

interface UserInfo {
  id: string
  email: string
  is_superuser: boolean
}

interface SidebarProps {
  user: UserInfo
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter()
  const { navigateTo, isActive } = useNavigation()
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

        // Fetch current workspace
        const currentResponse = await fetch('/api/workspaces/current')
        if (currentResponse.ok) {
          const currentData = await currentResponse.json()
          setCurrentWorkspace(currentData.workspace)

          // If no current workspace but user has workspaces, set the first one
          // Only do this on initial load to prevent loops
          if (!currentData.workspace && data.workspaces.length > 0 && isInitialLoad && !switchingWorkspace) {
            setSwitchingWorkspace(true)
            await handleWorkspaceChange(data.workspaces[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error)
    } finally {
      setLoading(false)
      setIsInitialLoad(false)
    }
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const handleWorkspaceChange = async (workspaceId: string) => {
    // Prevent infinite loop - don't switch if already switching to same workspace
    if (currentWorkspace?.id === workspaceId) {
      return
    }
    
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
        // Only refresh if not initial load (user manually switched)
        if (!isInitialLoad) {
          router.refresh()
        }
      }
    } catch (error) {
      console.error('Error switching workspace:', error)
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
      console.error('Logout failed:', error)
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
            className="h-12 rounded mb-4"
            style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}
          ></div>
          <div
            className="h-8 rounded mb-2"
            style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}
          ></div>
          <div
            className="h-8 rounded"
            style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}
          ></div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="w-64 border-r flex flex-col"
      style={{
        backgroundColor: `rgb(var(--sidebar-bg))`,
        borderColor: `rgb(var(--border-color))`,
      }}
    >
      {/* Workspace Selector */}
      <div
        className="p-4 border-b"
        style={{ borderColor: `rgb(var(--border-color))` }}
      >
        <WorkspaceSelector
          currentWorkspace={currentWorkspace}
          workspaces={workspaces}
          onWorkspaceChange={handleWorkspaceChange}
          onWorkspaceCreated={handleWorkspaceCreated}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => navigateTo('dashboard')}
              className={`flex items-center w-full px-4 py-2 rounded-lg transition-all ${
                isActive('dashboard') ? 'font-semibold' : ''
              }`}
              style={{
                color: `rgb(var(--text-primary))`,
                backgroundColor: isActive('dashboard') ? `rgb(var(--sidebar-active, var(--accent-primary, 59 130 246 / 0.1)))` : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive('dashboard')) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive('dashboard')) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span className="mr-3">📊</span>
              <span>Dashboard</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => navigateTo('chat')}
              className={`flex items-center w-full px-4 py-2 rounded-lg transition-all ${
                isActive('chat') ? 'font-semibold' : ''
              }`}
              style={{
                color: `rgb(var(--text-primary))`,
                backgroundColor: isActive('chat') ? `rgb(var(--sidebar-active, var(--accent-primary, 59 130 246 / 0.1)))` : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive('chat')) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive('chat')) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span className="mr-3">💬</span>
              <span>Chat</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => navigateTo('gateways')}
              className={`flex items-center w-full px-4 py-2 rounded-lg transition-all ${
                isActive('gateways') ? 'font-semibold' : ''
              }`}
              style={{
                color: `rgb(var(--text-primary))`,
                backgroundColor: isActive('gateways') ? `rgb(var(--sidebar-active, var(--accent-primary, 59 130 246 / 0.1)))` : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive('gateways')) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive('gateways')) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span className="mr-3">🔌</span>
              <span>Gateways</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => navigateTo('statuses')}
              className={`flex items-center w-full px-4 py-2 rounded-lg transition-all ${
                isActive('statuses') ? 'font-semibold' : ''
              }`}
              style={{
                color: `rgb(var(--text-primary))`,
                backgroundColor: isActive('statuses') ? `rgb(var(--sidebar-active, var(--accent-primary, 59 130 246 / 0.1)))` : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive('statuses')) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive('statuses')) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span className="mr-3">🏷️</span>
              <span>Statuses</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => navigateTo('settings')}
              className={`flex items-center w-full px-4 py-2 rounded-lg transition-all ${
                isActive('settings') ? 'font-semibold' : ''
              }`}
              style={{
                color: `rgb(var(--text-primary))`,
                backgroundColor: isActive('settings') ? `rgb(var(--sidebar-active, var(--accent-primary, 59 130 246 / 0.1)))` : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive('settings')) {
                  e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive('settings')) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span className="mr-3">⚙️</span>
              <span>Settings</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* User Section */}
      <div
        className="border-t p-4"
        style={{ borderColor: `rgb(var(--border-color))` }}
      >
        <button
          onClick={() => navigateTo('profile')}
          className={`flex items-center w-full px-4 py-2 mb-2 rounded-lg transition-all ${
            isActive('profile') ? 'font-semibold' : ''
          }`}
          style={{
            color: `rgb(var(--text-primary))`,
            backgroundColor: isActive('profile') ? `rgb(var(--sidebar-active, var(--accent-primary, 59 130 246 / 0.1)))` : 'transparent'
          }}
          onMouseEnter={(e) => {
            if (!isActive('profile')) {
              e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive('profile')) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <span className="mr-3">👤</span>
          <span>Profile</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center px-4 py-2 mb-3 rounded-lg transition-colors"
          style={{ color: `rgb(var(--text-primary))` }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <span className="mr-3">🚪</span>
          <span>Logout</span>
        </button>

        {/* Theme Switcher */}
        <div className="flex justify-center pt-2">
          <ThemeSwitcher />
        </div>
      </div>
    </aside>
  )
}
