'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/query/hooks'
import { useUserSettings } from '@/lib/query/hooks/useUserSettings'
import { useAgents } from '@/lib/query/hooks/useChat'
import type { PageContentProps } from './index'

type SettingsTab = 'general' | 'chat' | 'workspace' | 'danger'

export function SettingsPageContent({ user }: PageContentProps) {
  const router = useRouter()
  const { user: userData, isLoading } = useUser()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const { data: settings, isLoading: settingsLoading } = useUserSettings()
  const { data: agents, isLoading: agentsLoading } = useAgents()

  // Local state for form values
  const [summarizerAgentId, setSummarizerAgentId] = useState(settings?.summarizer_agent_id ?? '')
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(settings?.auto_summary_enabled ?? true)
  const [idleTimeout, setIdleTimeout] = useState(settings?.idle_timeout_minutes ?? 2)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !userData) {
      router.push('/login')
    }
  }, [userData, isLoading, router])

  // Sync local state when settings are loaded
  useEffect(() => {
    if (settings) {
      setSummarizerAgentId(settings.summarizer_agent_id ?? '')
      setAutoSummaryEnabled(settings.auto_summary_enabled ?? true)
      setIdleTimeout(settings.idle_timeout_minutes ?? 2)
    }
  }, [settings])

  if (isLoading || !userData) {
    return (
      <div className="flex items-center justify-center" style={{ height: '50vh' }}>
        <div style={{ color: `rgb(var(--text-secondary))` }}>Loading...</div>
      </div>
    )
  }

  const tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'general', label: 'General', icon: '⚙️' },
    { key: 'chat', label: 'Chat', icon: '💬' },
    { key: 'workspace', label: 'Workspace', icon: '👥' },
    { key: 'danger', label: 'Danger Zone', icon: '⚠️' },
  ]

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
          Settings
        </h1>
        <p className="mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
          Configure your application settings and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: 'rgb(var(--border-color))' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-medium transition-colors relative ${
              activeTab === tab.key ? '' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            style={{
              color: activeTab === tab.key ? 'rgb(var(--primary-color))' : 'rgb(var(--text-secondary))',
            }}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: 'rgb(var(--primary-color))' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div
        className="rounded-lg border p-6 shadow-sm"
        style={{
          backgroundColor: 'rgb(var(--bg-primary))',
          borderColor: 'rgb(var(--border-color))',
        }}
      >
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                General Settings
              </h2>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true)
                  setSaveMessage('Saving...')
                  setTimeout(() => {
                    setIsSaving(false)
                    setSaveMessage('Saved!')
                    setTimeout(() => setSaveMessage(''), 2000)
                  }, 500)
                }}
              >
                {isSaving ? 'Saving...' : saveMessage || 'Save Settings'}
              </button>
            </div>
            <div
              className="flex items-center justify-between py-3 border-b"
              style={{ borderColor: 'rgb(var(--border-color))' }}
            >
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  Notifications
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Manage your notification preferences
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))',
                }}
              >
                Configure
              </button>
            </div>
            <div
              className="flex items-center justify-between py-3 border-b"
              style={{ borderColor: 'rgb(var(--border-color))' }}
            >
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  Theme
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Customize your appearance settings
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))',
                }}
              >
                Customize
              </button>
            </div>
            <div
              className="flex items-center justify-between py-3"
              style={{ borderColor: 'rgb(var(--border-color))' }}
            >
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  Language
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Select your preferred language
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))',
                }}
              >
                Change
              </button>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
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
                    const body: any = {
                      auto_summary_enabled: autoSummaryEnabled,
                      idle_timeout_minutes: idleTimeout,
                    }
                    // Only include agent fields if an agent is selected
                    if (summarizerAgentId && selectedAgent) {
                      body.summarizer_agent_id = summarizerAgentId
                      body.summarizer_gateway_id = selectedAgent.gatewayId
                    } else {
                      body.summarizer_agent_id = null
                      body.summarizer_gateway_id = null
                    }

                    const res = await fetch('/api/user/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    })

                    if (!res.ok) {
                      const errorData = await res.json()
                      throw new Error(errorData.error || 'Failed to save settings')
                    }

                    setSaveMessage('Saved!')
                    setTimeout(() => setSaveMessage(''), 2000)
                  } catch (error) {
                    console.error('Error saving settings:', error)
                    setSaveMessage('Error saving')
                    setTimeout(() => setSaveMessage(''), 2000)
                  } finally {
                    setIsSaving(false)
                  }
                }}
              >
                {isSaving ? 'Saving...' : saveMessage || 'Save Settings'}
              </button>
            </div>

            {settingsLoading || agentsLoading ? (
              <div className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                Loading settings...
              </div>
            ) : (
              <>
                {/* Summarizer Agent Selection */}
                <div
                  className="flex flex-col gap-2 py-3 border-b"
                  style={{ borderColor: 'rgb(var(--border-color))' }}
                >
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                      Summarizer Agent
                    </p>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                      Select an agent to automatically generate chat summaries when sessions become idle
                    </p>
                  </div>
                  <select
                    className="px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: 'rgb(var(--bg-secondary))',
                      borderColor: 'rgb(var(--border-color))',
                      color: 'rgb(var(--text-primary))',
                    }}
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

                {/* Auto-Summary Toggle */}
                <div
                  className="flex items-center justify-between py-3 border-b"
                  style={{ borderColor: 'rgb(var(--border-color))' }}
                >
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                      Auto-Summary on Idle
                    </p>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                      Automatically summarize chat when session becomes idle
                    </p>
                  </div>
                  <button
                    className={`w-12 h-6 rounded-full transition-colors ${
                      autoSummaryEnabled ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    onClick={() => setAutoSummaryEnabled(!autoSummaryEnabled)}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                        autoSummaryEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Idle Timeout */}
                <div
                  className="flex items-center justify-between py-3"
                  style={{ borderColor: 'rgb(var(--border-color))' }}
                >
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                      Idle Timeout
                    </p>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                      Minutes of inactivity before auto-summary
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      className="w-16 px-2 py-1 rounded border text-center"
                      style={{
                        backgroundColor: 'rgb(var(--bg-secondary))',
                        borderColor: 'rgb(var(--border-color))',
                        color: 'rgb(var(--text-primary))',
                      }}
                      value={idleTimeout}
                      onChange={(e) => setIdleTimeout(parseInt(e.target.value) || 2)}
                    />
                    <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                      minutes
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Info Card */}
            <div
              className="mt-4 p-4 rounded-lg border"
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                borderColor: 'rgb(var(--border-color))',
              }}
            >
              <h4 className="font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
                How it works
              </h4>
              <ul className="space-y-1 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                <li>1. Select a summarizer agent from your connected gateways</li>
                <li>2. Enable auto-summary to automatically generate summaries when idle</li>
                <li>3. Adjust the idle timeout (default: 2 minutes)</li>
                <li>4. Manually trigger summaries using "📝 Summarize" button in chat</li>
                <li>5. Generated summaries update the chat title and description</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'workspace' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                Workspace Settings
              </h2>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true)
                  setSaveMessage('Saving...')
                  setTimeout(() => {
                    setIsSaving(false)
                    setSaveMessage('Saved!')
                    setTimeout(() => setSaveMessage(''), 2000)
                  }, 500)
                }}
              >
                {isSaving ? 'Saving...' : saveMessage || 'Save Settings'}
              </button>
            </div>
            <div
              className="flex items-center justify-between py-3 border-b"
              style={{ borderColor: 'rgb(var(--border-color))' }}
            >
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  Members
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Manage workspace members and permissions
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))',
                }}
              >
                Manage
              </button>
            </div>
            <div
              className="flex items-center justify-between py-3"
              style={{ borderColor: 'rgb(var(--border-color))' }}
            >
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                  Billing
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  View and manage your subscription
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))',
                }}
              >
                View
              </button>
            </div>
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-red-600" style={{ color: 'rgb(239 68 68)' }}>
                Danger Zone
              </h2>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving}
              >
                Delete Workspace
              </button>
            </div>
            <div
              className="flex items-center justify-between py-3 border rounded-lg"
              style={{ borderColor: 'rgb(239 68 68)' }}
            >
              <div>
                <p className="font-medium text-red-600">Delete Workspace</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Permanently delete your workspace and all data
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
