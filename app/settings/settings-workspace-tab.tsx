'use client'

import { Button } from '@/components/ui/button'

interface WorkspaceStatus {
  id: string
  name: string
}

interface WorkspaceTabProps {
  maxImagesPerPost: number
  allowPdfAttachments: boolean
  staleTicketThreshold: number
  staleTicketTargetStatus: string
  workspaceStatuses: WorkspaceStatus[]
  isSaving: boolean
  saveMessage: string
  onMaxImagesChange: (v: number) => void
  onAllowPdfChange: (v: boolean) => void
  onStaleThresholdChange: (v: number) => void
  onStaleTargetChange: (v: string) => void
  onSave: () => void
}

export function WorkspaceTab({
  maxImagesPerPost,
  allowPdfAttachments,
  staleTicketThreshold,
  staleTicketTargetStatus,
  workspaceStatuses,
  isSaving,
  saveMessage,
  onMaxImagesChange,
  onAllowPdfChange,
  onStaleThresholdChange,
  onStaleTargetChange,
  onSave,
}: WorkspaceTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Workspace Settings</h2>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : saveMessage || 'Save Settings'}
        </Button>
      </div>

      <div className="flex items-center justify-between border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Max images per post</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Controls how many pasted or dropped images are allowed by default in chat and ticket editors.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="20"
            className="w-20 rounded border px-2 py-1 text-center"
            style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
            value={maxImagesPerPost}
            onChange={(e) => onMaxImagesChange(parseInt(e.target.value) || 5)}
          />
          <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>images</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Allow PDF attachments</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Enables PDF files in the shared text area component alongside image paste and drag-drop.</p>
        </div>
        <button
          className={`h-6 w-12 rounded-full transition-colors ${allowPdfAttachments ? 'bg-blue-500' : 'bg-gray-300'}`}
          onClick={() => onAllowPdfChange(!allowPdfAttachments)}
        >
          <div className={`h-5 w-5 transform rounded-full bg-white shadow transition-transform ${allowPdfAttachments ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="flex items-center justify-between border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Stale Ticket Auto-Transition</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Automatically move tickets to a status when no comments for X minutes. Requires cron job enabled.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="1440"
            className="w-20 rounded border px-2 py-1 text-center"
            style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
            value={staleTicketThreshold}
            onChange={(e) => onStaleThresholdChange(parseInt(e.target.value) || 20)}
          />
          <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>minutes →</span>
          <select
            className="rounded border px-3 py-1"
            style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
            value={staleTicketTargetStatus}
            onChange={(e) => onStaleTargetChange(e.target.value)}
          >
            {workspaceStatuses.map((status) => (
              <option key={status.id} value={status.name}>{status.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Members</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Manage workspace members and permissions</p>
        </div>
        <button className="rounded-lg border px-4 py-2" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>Manage</button>
      </div>

      <div className="flex items-center justify-between py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Billing</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>View and manage your subscription</p>
        </div>
        <button className="rounded-lg border px-4 py-2" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>View</button>
      </div>
    </div>
  )
}
