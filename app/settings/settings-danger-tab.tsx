'use client'

import { Button } from '@/components/ui/button'

interface DangerTabProps {
  isSaving: boolean
}

export function DangerTab({ isSaving }: DangerTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-red-600" style={{ color: 'rgb(239 68 68)' }}>Danger Zone</h2>
        <Button onClick={() => {}} disabled={isSaving} variant="destructive">
          Delete Workspace
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border py-3" style={{ borderColor: 'rgb(239 68 68)' }}>
        <div>
          <p className="font-medium text-red-600">Delete Workspace</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Permanently delete your workspace and all data</p>
        </div>
        <Button onClick={() => {}} variant="destructive">
          Delete
        </Button>
      </div>
    </div>
  )
}
