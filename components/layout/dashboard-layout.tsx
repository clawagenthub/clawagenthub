'use client'

import React from 'react'
import { Sidebar } from '@/components/layout/sidebar'

interface UserInfo {
  id: string
  email: string
  is_superuser: boolean
}

interface DashboardLayoutProps {
  user: UserInfo
  children: React.ReactNode
  noPadding?: boolean
}

export function DashboardLayout({ user, children, noPadding }: DashboardLayoutProps) {
  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: `rgb(var(--bg-secondary))` }}
    >
      <Sidebar user={user} />
      <main
        className={`flex-1 flex flex-col ${noPadding ? '' : 'p-8'}`}
        style={{ color: `rgb(var(--text-primary))` }}
      >
        {children}
      </main>
    </div>
  )
}
