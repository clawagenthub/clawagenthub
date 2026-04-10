'use client'

import { Button } from '@/components/ui/button'
import type { Agent } from '@/lib/query/hooks/useChat'

interface ChatTabProps {
  summarizerAgentId: string
  autoSummaryEnabled: boolean
  idleTimeout: number
  agents: Agent[] | undefined
  isSaving: boolean
  saveMessage: string
  settingsLoading: boolean
  agentsLoading: boolean
  onSummarizerAgentIdChange: (id: string) => void
  onAutoSummaryChange: (enabled: boolean) => void
  onIdleTimeoutChange: (minutes: number) => void
  onSave: () => void
}

export function ChatTab({
  summarizerAgentId,
  autoSummaryEnabled,
  idleTimeout,
  agents,
  isSaving,
  saveMessage,
  settingsLoading,
  agentsLoading,
  onSummarizerAgentIdChange,
  onAutoSummaryChange,
  onIdleTimeoutChange,
  onSave,
}: ChatTabProps) {
  if (settingsLoading || agentsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Chat Summary Settings</h2>
        </div>
        <div className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Chat Summary Settings</h2>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : saveMessage || 'Save Settings'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Summarizer Agent</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Select an agent to automatically generate chat summaries when sessions become idle</p>
        </div>
        <select
          className="rounded-lg border px-3 py-2"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
          value={summarizerAgentId}
          onChange={(e) => onSummarizerAgentIdChange(e.target.value)}
        >
          <option value="">None selected</option>
          {agents?.map((agent) => (
            <option key={agent.agentId} value={agent.agentId}>
              {agent.agentName} ({agent.gatewayName})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Auto Summary</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Automatically generate summaries for idle chat sessions</p>
        </div>
        <button
          className={`relative h-6 w-11 rounded-full transition-colors ${autoSummaryEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          onClick={() => onAutoSummaryChange(!autoSummaryEnabled)}
          style={{ backgroundColor: autoSummaryEnabled ? 'rgb(var(--primary-color))' : undefined }}
        >
          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${autoSummaryEnabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Idle Timeout</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Minutes of inactivity before triggering summary ({idleTimeout} min)</p>
        </div>
        <input
          type="range"
          min="1"
          max="30"
          value={idleTimeout}
          onChange={(e) => onIdleTimeoutChange(parseInt(e.target.value))}
          className="w-32"
        />
      </div>
    </div>
  )
}
