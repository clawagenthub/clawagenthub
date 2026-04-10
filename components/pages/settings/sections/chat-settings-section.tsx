'use client'

import { useState } from 'react'
import { useAgents } from '@/lib/query/hooks/useChat'

interface ChatSettingsSectionProps {
  summarizerAgentId: string
  setSummarizerAgentId: (id: string) => void
  autoSummaryEnabled: boolean
  setAutoSummaryEnabled: (enabled: boolean) => void
  idleTimeout: number
  setIdleTimeout: (timeout: number) => void
  isSaving: boolean
  setIsSaving: (saving: boolean) => void
  setSaveMessage: (message: string) => void
  settingsLoading: boolean
}

export function ChatSettingsSection({
  summarizerAgentId,
  setSummarizerAgentId,
  autoSummaryEnabled,
  setAutoSummaryEnabled,
  idleTimeout,
  setIdleTimeout,
  isSaving,
  setIsSaving,
  setSaveMessage,
  settingsLoading,
}: ChatSettingsSectionProps) {
  const { data: agents, isLoading: agentsLoading } = useAgents()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
          Chat Summary Settings
        </h2>
        <button
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSaving || settingsLoading || agentsLoading}
          onClick={async () => {
            setIsSaving(true)
            setSaveMessage('Saving...')
            try {
              const selectedAgent = agents?.find((a) => a.agentId === summarizerAgentId)
              const body: any = { auto_summary_enabled: autoSummaryEnabled, idle_timeout_minutes: idleTimeout }
              if (summarizerAgentId && selectedAgent) {
                body.summarizer_agent_id = summarizerAgentId
                body.summarizer_gateway_id = selectedAgent.gatewayId
              } else {
                body.summarizer_agent_id = null
                body.summarizer_gateway_id = null
              }
              const res = await fetch('/api/user/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
              if (!res.ok) throw new Error((await res.json()).error || 'Failed to save settings')
              setSaveMessage('Saved!')
              setTimeout(() => setSaveMessage(''), 2000)
            } catch (error) {
              logger.error('Error saving chat settings:', error)
              setSaveMessage('Error saving')
              setTimeout(() => setSaveMessage(''), 2000)
            } finally {
              setIsSaving(false)
            }
          }}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Auto Summary</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Automatically summarize long chat sessions</p>
        </div>
        <button
          type="button"
          onClick={() => setAutoSummaryEnabled(!autoSummaryEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            autoSummaryEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              autoSummaryEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Idle Timeout</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Minutes of inactivity before auto-summarizing</p>
        </div>
        <input
          type="number"
          min="1"
          max="60"
          className="w-20 px-2 py-1 rounded border text-center"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
          value={idleTimeout}
          onChange={(e) => setIdleTimeout(parseInt(e.target.value) || 2)}
        />
      </div>

      <div className="flex flex-col gap-2 py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Summarizer Agent</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Agent used to summarize chat sessions</p>
        </div>
        <select
          className="px-3 py-2 rounded-lg border"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
          value={summarizerAgentId}
          onChange={(e) => setSummarizerAgentId(e.target.value)}
        >
          <option value="">None selected</option>
          {agents?.map((agent) => (
            <option key={agent.agentId} value={agent.agentId}>
              {agent.agentName} ({agent.gatewayName})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// Need logger import
import logger from '@/lib/logger/index.js'
