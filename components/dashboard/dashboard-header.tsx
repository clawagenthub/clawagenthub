'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Local storage key for show drafts toggle
const SHOW_DRAFTS_KEY = 'dashboard-show-drafts'

// Get show drafts preference from localStorage
function getShowDraftsPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const value = localStorage.getItem(SHOW_DRAFTS_KEY)
    return value === 'true'
  } catch {
    return false
  }
}

// Save show drafts preference to localStorage
function setShowDraftsPreference(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SHOW_DRAFTS_KEY, String(value))
  } catch {
    // Ignore storage errors
  }
}

interface DashboardHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  flowStatusFilter: string
  onFlowStatusFilterChange: (filter: string) => void
  selectedTicketIds: string[]
  statuses: Array<{ id: string; name: string; color: string }>
  onBulkMoveTo: (targetStatusId: string) => void
  onBulkDelete: () => void
  showDrafts: boolean
  onShowDraftsChange: (show: boolean) => void
  onAddTicket: () => void
}

export function DashboardHeader({
  searchQuery,
  onSearchChange,
  flowStatusFilter,
  onFlowStatusFilterChange,
  selectedTicketIds,
  statuses,
  onBulkMoveTo,
  onBulkDelete,
  showDrafts,
  onShowDraftsChange,
  onAddTicket,
}: DashboardHeaderProps) {
  const [showBulkMenu, setShowBulkMenu] = useState(false)

  // Load show drafts preference on mount
  useEffect(() => {
    onShowDraftsChange(getShowDraftsPreference())
  }, [onShowDraftsChange])

  return (
    <div className="flex-shrink-0 mb-6 flex items-center justify-between">
      <div>
        <h1
          className="text-3xl font-bold"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Dashboard
        </h1>
        <p
          className="mt-2"
          style={{ color: `rgb(var(--text-secondary))` }}
        >
          Manage your boards and organize your work
        </p>
      </div>
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tickets..."
            className="pl-9 pr-4 py-2 rounded-lg text-sm border w-64"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
            }}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'rgb(var(--text-tertiary))' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Flow Status Filter */}
        <select
          value={flowStatusFilter}
          onChange={(e) => onFlowStatusFilterChange(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
          }}
        >
          <option value="all">All Flow Status</option>
          <option value="flowing">Flowing</option>
          <option value="failed">Failed</option>
          <option value="waiting">Waiting</option>
          <option value="waiting_to_flow">Waiting to Flow</option>
          <option value="stopped">Stopped</option>
          <option value="completed">Completed</option>
        </select>

        {/* Bulk Actions Dropdown */}
        {selectedTicketIds.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBulkMenu(!showBulkMenu)}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              style={{
                backgroundColor: 'rgb(var(--accent-primary, 59 130, 246))',
                color: 'white',
              }}
            >
              {selectedTicketIds.length} Selected ▼
            </button>
            {showBulkMenu && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-lg border shadow-lg z-50"
                style={{
                  backgroundColor: 'rgb(var(--bg-primary))',
                  borderColor: 'rgb(var(--border-color))',
                }}
              >
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold" style={{ color: 'rgb(var(--text-tertiary))' }}>
                    Move to Status
                  </div>
                  {statuses.map(status => (
                    <button
                      key={status.id}
                      onClick={() => {
                        onBulkMoveTo(status.id)
                        setShowBulkMenu(false)
                      }}
                      className="flex w-full items-center px-4 py-2 text-left text-sm transition-colors"
                      style={{ color: 'rgb(var(--text-primary))' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--bg-secondary))'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: status.color }} />
                      {status.name}
                    </button>
                  ))}
                  <div
                    className="my-1 border-t"
                    style={{ borderColor: 'rgb(var(--border-color))' }}
                  />
                  <button
                    onClick={() => {
                      onBulkDelete()
                      setShowBulkMenu(false)
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm transition-colors"
                    style={{ color: 'rgb(220, 38, 38)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Delete Selected
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show Drafts Toggle */}
        <button
          type="button"
          onClick={() => {
            const newValue = !showDrafts
            onShowDraftsChange(newValue)
            setShowDraftsPreference(newValue)
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          style={{
            backgroundColor: showDrafts
              ? 'rgba(59, 130, 246, 0.1)'
              : 'rgb(var(--bg-secondary))',
            color: showDrafts
              ? 'rgb(59, 130, 246)'
              : 'rgb(var(--text-secondary))',
            border: '1px solid rgb(var(--border-color))',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = showDrafts
              ? 'rgb(59, 130, 246)'
              : 'rgb(var(--text-tertiary))'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgb(var(--border-color))'
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {showDrafts ? 'Drafts: ON' : 'Drafts: OFF'}
        </button>

        {/* Add Ticket Button */}
        <button
          type="button"
          onClick={onAddTicket}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Ticket
        </button>
      </div>
    </div>
  )
}