'use client'

import { Button } from '@/components/ui/button'

interface LoadingStateProps {
  count?: number
}

export function BoardLoadingState({ count = 6 }: LoadingStateProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="w-[calc((100vw-12rem-4rem)/3)] rounded-lg p-4 border-2 animate-pulse flex-shrink-0 snap-start"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderColor: `rgb(var(--border-color))`,
          }}
        >
          <div className="h-6 bg-gray-300 rounded mb-4 w-1/2"></div>
          <div className="space-y-2">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </>
  )
}

interface ErrorStateProps {
  error: Error | null
  onRetry: () => void
}

export function BoardErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div
      className="col-span-3 flex flex-col items-center justify-center rounded-lg border p-12 max-w-md mx-auto"
      style={{
        backgroundColor: `rgb(var(--bg-secondary))`,
        borderColor: `rgb(var(--border-color))`,
      }}
    >
      <div className="mb-4 text-4xl">⚠️</div>
      <h3
        className="mb-2 text-lg font-medium"
        style={{ color: `rgb(var(--text-primary))` }}
      >
        Error Loading Boards
      </h3>
      <p
        className="mb-4 text-center"
        style={{ color: `rgb(var(--text-secondary))` }}
      >
        {error instanceof Error ? error.message : 'Failed to load status boards'}
      </p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  )
}

interface EmptyStateProps {
  message?: string
}

export function BoardEmptyState({ message }: EmptyStateProps) {
  return (
    <div
      className="col-span-3 flex flex-col items-center justify-center rounded-lg border p-12 max-w-md mx-auto"
      style={{
        backgroundColor: `rgb(var(--bg-secondary))`,
        borderColor: `rgb(var(--border-color))`,
      }}
    >
      <div className="mb-4 text-4xl">📋</div>
      <h3
        className="mb-2 text-lg font-medium"
        style={{ color: `rgb(var(--text-primary))` }}
      >
        No Status Boards Yet
      </h3>
      <p
        className="text-center"
        style={{ color: `rgb(var(--text-secondary))` }}
      >
        {message || 'Create statuses in the Statuses page to see them as boards here.'}
      </p>
    </div>
  )
}