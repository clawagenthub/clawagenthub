'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser, useWorkspacePrompts, useUpdateWorkspacePrompts, useDeletePromptMutation, useAddCustomPrompt, type WorkspacePrompt } from '@/lib/query/hooks'
import { useUserSettings } from '@/lib/query/hooks/useUserSettings'
import { useAgents } from '@/lib/query/hooks/useChat'
import { useGateways } from '@/lib/query/hooks'
import { GatewayCard } from '@/components/gateway/gateway-card'
import { AddGatewayModal } from '@/components/gateway/add-gateway-modal'
import { Button } from '@/components/ui/button'
import { DEFAULT_FLOW_TEMPLATE } from '@/lib/utils/flow-template'
import { DEFAULT_AUTO_TICKET_CONVERTER_TEMPLATE } from '@/lib/utils/prompts/autoTicketConverterPrompt'
import { DEFAULT_SELECTED_TICKET_CONVERTER_TEMPLATE } from '@/lib/utils/prompts/selectedTicketConverterPrompt'
import { PromptDetailModal } from '@/components/ui/prompt-detail-modal'
import { LoadDefaultPromptsModal } from '@/components/ui/load-default-prompts-modal'
import { AddCustomPromptModal } from '@/components/ui/add-custom-prompt-modal'
import type { PageContentProps } from './index'
import type { Gateway } from '@/lib/db/schema'

type SettingsTab = 'general' | 'chat' | 'flow' | 'workspace' | 'gateway' | 'defaultprompts' | 'prompttemplates' | 'skillsmp' | 'danger'

const DEFAULT_MAX_IMAGES_PER_POST = 5

function SettingsContent({ user }: PageContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: userData, isLoading } = useUser()
  const [activeTab, setActiveTabState] = useState<SettingsTab>('general')
  const { data: settings, isLoading: settingsLoading } = useUserSettings()
  const { data: agents, isLoading: agentsLoading } = useAgents()
  const { gateways, isLoading: gatewaysLoading, refresh } = useGateways()

  // Default prompts state
  const [selectedPrompt, setSelectedPrompt] = useState<WorkspacePrompt | null>(null)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [isLoadDefaultsModalOpen, setIsLoadDefaultsModalOpen] = useState(false)
  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false)

  const { data: prompts, isLoading: promptsLoading } = useWorkspacePrompts()
  const updatePrompts = useUpdateWorkspacePrompts()
  const deletePrompt = useDeletePromptMutation()
  const addCustomPrompt = useAddCustomPrompt()

  const [showAddModal, setShowAddModal] = useState(false)
  const [summarizerAgentId, setSummarizerAgentId] = useState(settings?.summarizer_agent_id ?? '')
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(settings?.auto_summary_enabled ?? true)
  const [idleTimeout, setIdleTimeout] = useState(settings?.idle_timeout_minutes ?? 2)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [flowPromptTemplate, setFlowPromptTemplate] = useState('')
  const [flowTimeoutSeconds, setFlowTimeoutSeconds] = useState(600)
  const [onflowlimit, setOnflowlimit] = useState(10)
  const [flowTemplateLoading, setFlowTemplateLoading] = useState(true)
  const [loadMessage, setLoadMessage] = useState('')
  const [skillsmpApiKey, setSkillsmpApiKey] = useState('')
  const [skillsmpSaving, setSkillsmpSaving] = useState(false)
  const [skillsmpMessage, setSkillsmpMessage] = useState('')
  const [maxImagesPerPost, setMaxImagesPerPost] = useState(DEFAULT_MAX_IMAGES_PER_POST)
  const [allowPdfAttachments, setAllowPdfAttachments] = useState(true)

  // Prompt Templates state
  const [promptConverterAgentId, setPromptConverterAgentId] = useState('')
  const [promptTemplatesSaving, setPromptTemplatesSaving] = useState(false)
  const [promptTemplatesMessage, setPromptTemplatesMessage] = useState('')
  const [autoPromptTemplate, setAutoPromptTemplate] = useState('')
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState('')
  const [autoPromptTemplateLoadMessage, setAutoPromptTemplateLoadMessage] = useState('')
  const [selectedPromptTemplateLoadMessage, setSelectedPromptTemplateLoadMessage] = useState('')
  const [defaultPromptsTimeaout, setDefaultPromptsTimeaout] = useState(120)

  useEffect(() => {
    const tab = searchParams.get('tab') as SettingsTab | null
    if (tab && ['general', 'chat', 'flow', 'workspace', 'gateway', 'defaultprompts', 'prompttemplates', 'skillsmp', 'danger'].includes(tab)) {
      setActiveTabState(tab)
    }
  }, [searchParams])

  const setActiveTab = (tab: SettingsTab) => {
    setActiveTabState(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.pushState({}, '', url)
  }

  useEffect(() => {
    if (!isLoading && !userData) {
      router.push('/login')
    }
  }, [userData, isLoading, router])

  useEffect(() => {
    if (settings) {
      setSummarizerAgentId(settings.summarizer_agent_id ?? '')
      setAutoSummaryEnabled(settings.auto_summary_enabled ?? true)
      setIdleTimeout(settings.idle_timeout_minutes ?? 2)
    }
  }, [settings])

  useEffect(() => {
    async function fetchWorkspaceSettings() {
      try {
        setFlowTemplateLoading(true)
        const res = await fetch('/api/workspaces/settings')
        if (res.ok) {
          const data = await res.json()
          setFlowPromptTemplate(data.flow_prompt_template || '')
          setSkillsmpApiKey(data.skillsmp_api_key || '')
          setFlowTimeoutSeconds(data.flow_timeout_seconds ? parseInt(data.flow_timeout_seconds) : 600)
          setOnflowlimit(data.onflowlimit ? parseInt(data.onflowlimit) : 0)
          setPromptConverterAgentId(data.prompt_converter_agent_id || '')
          setAutoPromptTemplate(data.auto_prompt_template || '')
          setSelectedPromptTemplate(data.selected_prompt_template || '')
          setMaxImagesPerPost(data.max_images_per_post ? parseInt(data.max_images_per_post) : DEFAULT_MAX_IMAGES_PER_POST)
          setAllowPdfAttachments(data.allow_pdf_attachments ? data.allow_pdf_attachments === 'true' : true)
          setDefaultPromptsTimeaout(data.defaultPromptsTimeaout ? parseInt(data.defaultPromptsTimeaout) : 120)
        }
      } catch (error) {
        console.error('Error fetching workspace settings:', error)
      } finally {
        setFlowTemplateLoading(false)
      }
    }
    fetchWorkspaceSettings()
  }, [])

  const handleConnect = async (gateway: Gateway) => {
    try {
      const response = await fetch(`/api/gateways/${gateway.id}/connect`, {
        method: 'POST',
      })
      const data = await response.json()
      if (response.ok) {
        await refresh()
      } else {
        alert(data.message || 'Failed to connect to gateway')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to connect to gateway')
    }
  }

  const handleDelete = async (gatewayId: string) => {
    await refresh()
  }

  const handleAddSuccess = () => {
    refresh()
  }

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
    { key: 'flow', label: 'Flow', icon: '🔄' },
    { key: 'workspace', label: 'Workspace', icon: '👥' },
    { key: 'gateway', label: 'Gateway', icon: '🔌' },
    { key: 'defaultprompts', label: 'Default Prompts', icon: '📝' },
    { key: 'prompttemplates', label: 'Prompt Templates', icon: '📋' },
    { key: 'skillsmp', label: 'SkillsMP', icon: '🔌' },
    { key: 'danger', label: 'Danger Zone', icon: '⚠️' },
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
          Settings
        </h1>
        <p className="mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
          Configure your application settings and preferences
        </p>
      </div>

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

      <div
        className="rounded-lg border p-6 shadow-sm overflow-y-auto"
        style={{
          backgroundColor: 'rgb(var(--bg-primary))',
          borderColor: 'rgb(var(--border-color))',
          maxHeight: 'calc(100vh - 16rem)'
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
            <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Notifications</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Manage your notification preferences</p>
              </div>
              <button className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>Configure</button>
            </div>
            <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Theme</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Customize your appearance settings</p>
              </div>
              <button className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>Customize</button>
            </div>
            <div className="flex items-center justify-between py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Language</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Select your preferred language</p>
              </div>
              <button className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>Change</button>
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
              <div className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading settings...</div>
            ) : (
              <>
                <div className="flex flex-col gap-2 py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Summarizer Agent</p>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Select an agent to automatically generate chat summaries when sessions become idle</p>
                  </div>
                  <select className="px-3 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }} value={summarizerAgentId} onChange={(e) => setSummarizerAgentId(e.target.value)}>
                    <option value="">None selected</option>
                    {agents?.map((agent) => <option key={agent.agentId} value={agent.agentId}>{agent.agentName} ({agent.gatewayName})</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Auto-Summary on Idle</p>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Automatically summarize chat when session becomes idle</p>
                  </div>
                  <button className={`w-12 h-6 rounded-full transition-colors ${autoSummaryEnabled ? 'bg-blue-500' : 'bg-gray-300'}`} onClick={() => setAutoSummaryEnabled(!autoSummaryEnabled)}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${autoSummaryEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Idle Timeout</p>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Minutes of inactivity before auto-summary</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="60" className="w-16 px-2 py-1 rounded border text-center" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }} value={idleTimeout} onChange={(e) => setIdleTimeout(parseInt(e.target.value) || 2)} />
                    <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>minutes</span>
                  </div>
                </div>
              </>
            )}
            <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }}>
              <h4 className="font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>How it works</h4>
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

        {activeTab === 'flow' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Flow Settings</h2>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }} disabled={flowTemplateLoading} onClick={() => { setFlowPromptTemplate(DEFAULT_FLOW_TEMPLATE); setLoadMessage('Default template loaded'); setTimeout(() => setLoadMessage(''), 2000) }}>
                  {loadMessage || 'Load Default Template'}
                </button>
                <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSaving || flowTemplateLoading} onClick={async () => {
                  setIsSaving(true)
                  setSaveMessage('Saving...')
                  try {
                    const res = await fetch('/api/workspaces/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flow_prompt_template: flowPromptTemplate, flow_timeout_seconds: flowTimeoutSeconds.toString(), onflowlimit: onflowlimit.toString() }) })
                    if (res.ok) { setSaveMessage('Saved!'); setTimeout(() => setSaveMessage(''), 2000) }
                    else throw new Error((await res.json()).message || 'Failed to save settings')
                  } catch (error) { console.error('Error saving flow settings:', error); setSaveMessage('Error saving'); setTimeout(() => setSaveMessage(''), 2000) }
                  finally { setIsSaving(false) }
                }}>
                  {isSaving ? 'Saving...' : saveMessage || 'Save Settings'}
                </button>
              </div>
            </div>
            {flowTemplateLoading ? (
              <div className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading settings...</div>
            ) : (
              <>
                <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Flow Timeout</p>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Maximum time to wait for agent response during flow execution</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="60" 
                      max="3600" 
                      className="w-20 px-2 py-1 rounded border text-center" 
                      style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }} 
                      value={flowTimeoutSeconds} 
                      onChange={(e) => setFlowTimeoutSeconds(parseInt(e.target.value) || 600)} 
                    />
                    <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>seconds</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Max Concurrent Flowing Tickets</p>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Maximum number of tickets that can flow simultaneously (0 = unlimited)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max="1000" 
                      className="w-20 px-2 py-1 rounded border text-center" 
                      style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }} 
                      value={onflowlimit} 
                      onChange={(e) => setOnflowlimit(parseInt(e.target.value) || 0)} 
                    />
                    <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>tickets</span>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <label className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Custom Prompt Template</label>
                  <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Customize the prompt sent to agents during ticket flow execution. Leave empty to use the default template.</p>
                  <textarea className="w-full px-3 py-2 rounded-lg border font-mono text-sm" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))', minHeight: '400px', fontFamily: 'monospace' }} value={flowPromptTemplate} onChange={(e) => setFlowPromptTemplate(e.target.value)} placeholder="Enter custom template or leave empty for default..." />
                </div>
                <div className="p-4 rounded-lg border mt-4" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }}>
                  <h4 className="font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>Available Variables</h4>
                  <p className="text-sm mb-3" style={{ color: 'rgb(var(--text-secondary))' }}>Use these variables in your template. They will be replaced with actual values when the agent is triggered.</p>
                  <div className="grid grid-cols-2 gap-3 overflow-x-hidden">
                    {[
                      ['{$domain}', 'Application domain (BASE_URL)'], ['{$tempPath}', 'Temp file path for agent artifacts'],
                      ['{$ticketId}', 'Ticket ID'], ['{$ticketNumber}', 'Ticket number'], ['{$ticketTitle}', 'Ticket title'],
                      ['{$ticketDescription}', 'Ticket description'], ['{$currentStatusId}', 'Current status ID'],
                      ['{$currentStatusName}', 'Current status name'], ['{$currentStatusDescription}', 'Status description'],
                      ['{$agentId}', 'Agent ID'], ['{$statusInstructions}', 'Status instructions'],
                      ['{$commentsJson}', 'Comments JSON'], ['{$ticketJson}', 'Ticket JSON'], ['{$workspaceId}', 'Workspace ID'],
                      ['{$onflowlimit}', 'Max concurrent flowing tickets (0 = unlimited)'],
                      ['{$sessionToken}', 'Session token for API authentication']
                    ].map(([code, label]) => (
                      <div key={code}>
                        <code className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>{code}</code>
                        <span className="text-sm ml-2" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'workspace' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Workspace Settings</h2>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSaving} onClick={async () => { setIsSaving(true); setSaveMessage('Saving...'); try { const res = await fetch('/api/workspaces/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ max_images_per_post: String(maxImagesPerPost), allow_pdf_attachments: String(allowPdfAttachments) }) }); if (!res.ok) throw new Error((await res.json()).message || 'Failed to save settings'); setSaveMessage('Saved!'); setTimeout(() => setSaveMessage(''), 2000) } catch (error) { console.error('Error saving workspace settings:', error); setSaveMessage('Error saving'); setTimeout(() => setSaveMessage(''), 2000) } finally { setIsSaving(false) } }}>
                {isSaving ? 'Saving...' : saveMessage || 'Save Settings'}
              </button>
            </div>
            <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Max images per post</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Controls how many pasted or dropped images are allowed by default in chat and ticket editors.</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="20" className="w-20 px-2 py-1 rounded border text-center" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }} value={maxImagesPerPost} onChange={(e) => setMaxImagesPerPost(parseInt(e.target.value) || DEFAULT_MAX_IMAGES_PER_POST)} />
                <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>images</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Allow PDF attachments</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Enables PDF files in the shared text area component alongside image paste and drag-drop.</p>
              </div>
              <button className={`w-12 h-6 rounded-full transition-colors ${allowPdfAttachments ? 'bg-blue-500' : 'bg-gray-300'}`} onClick={() => setAllowPdfAttachments(!allowPdfAttachments)}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${allowPdfAttachments ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Members</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Manage workspace members and permissions</p>
              </div>
              <button className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>Manage</button>
            </div>
            <div className="flex items-center justify-between py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Billing</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>View and manage your subscription</p>
              </div>
              <button className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>View</button>
            </div>
          </div>
        )}

        {activeTab === 'gateway' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Gateways</h2>
                <p className="mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>Manage your OpenClaw Gateway connections</p>
              </div>
              <Button onClick={() => setShowAddModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Gateway
              </Button>
            </div>
            {gatewaysLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4" style={{ color: 'rgb(var(--text-secondary))' }}>Loading gateways...</p>
              </div>
            ) : gateways.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No gateways</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by adding your first gateway.</p>
                <div className="mt-6">
                  <Button onClick={() => setShowAddModal(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Gateway
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {gateways.map((gateway) => <GatewayCard key={gateway.id} gateway={gateway} onConnect={handleConnect} onDelete={handleDelete} onUpdate={refresh} />)}
              </div>
            )}
            <AddGatewayModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={handleAddSuccess} />
          </div>
        )}

        {activeTab === 'defaultprompts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                Default Prompts
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsLoadDefaultsModalOpen(true)}
                  className="px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: 'rgb(var(--bg-secondary))',
                    borderColor: 'rgb(var(--border-color))',
                    color: 'rgb(var(--text-primary))',
                  }}
                >
                  Load Default Prompts
                </button>
                <button
                  onClick={() => setIsAddCustomModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Add Custom Prompt
                </button>
              </div>
            </div>

            <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
              Manage prompts that can be loaded into ticket descriptions. Click on a prompt to view details.
            </p>

            {promptsLoading ? (
              <div className="text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>
                Loading prompts...
              </div>
            ) : prompts && prompts.length > 0 ? (
              <div
                className="border rounded-lg overflow-hidden"
                style={{ borderColor: 'rgb(var(--border-color))' }}
              >
                {prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="p-4 border-b last:border-b-0 cursor-pointer hover:bg-opacity-50 transition-colors"
                    style={{ borderColor: 'rgb(var(--border-color))' }}
                    onClick={() => {
                      setSelectedPrompt(prompt)
                      setIsPromptModalOpen(true)
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                            {prompt.name}
                          </p>
                          {prompt.isCustom && (
                            <span
                              className="px-1.5 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: 'rgb(var(--primary-color))',
                                color: 'white',
                              }}
                            >
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                          {prompt.description}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Are you sure you want to delete this prompt?')) {
                            deletePrompt.mutate({
                              promptId: prompt.id,
                              currentPrompts: prompts,
                            })
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded transition-colors hover:bg-red-100"
                        style={{
                          backgroundColor: 'rgb(var(--bg-secondary))',
                          color: 'rgb(239 68 68)',
                          border: '1px solid rgb(239 68 68)',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border rounded-lg" style={{ borderColor: 'rgb(var(--border-color))', borderStyle: 'dashed' }}>
                <p className="text-lg mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
                  No prompts configured
                </p>
                <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Load default prompts or add your own custom prompts.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setIsLoadDefaultsModalOpen(true)}
                    className="px-4 py-2 rounded-lg border transition-colors"
                    style={{
                      backgroundColor: 'rgb(var(--bg-secondary))',
                      borderColor: 'rgb(var(--border-color))',
                      color: 'rgb(var(--text-primary))',
                    }}
                  >
                    Load Default Prompts
                  </button>
                  <button
                    onClick={() => setIsAddCustomModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Add Custom Prompt
                  </button>
                </div>
              </div>
            )}

            <PromptDetailModal
              isOpen={isPromptModalOpen}
              onClose={() => setIsPromptModalOpen(false)}
              prompt={selectedPrompt}
            />

            <LoadDefaultPromptsModal
              isOpen={isLoadDefaultsModalOpen}
              onClose={() => setIsLoadDefaultsModalOpen(false)}
              onLoad={(newPrompts) => {
                updatePrompts.mutate([...(prompts || []), ...newPrompts])
              }}
              existingPromptIds={prompts?.map(p => p.id) || []}
            />

            <AddCustomPromptModal
              isOpen={isAddCustomModalOpen}
              onClose={() => setIsAddCustomModalOpen(false)}
              onAdd={async (prompt) => {
                await addCustomPrompt(prompt)
              }}
            />
          </div>
        )}

        {activeTab === 'prompttemplates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Prompt Templates Settings</h2>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={promptTemplatesSaving || agentsLoading}
                onClick={async () => {
                  setPromptTemplatesSaving(true)
                  setPromptTemplatesMessage('Saving...')
                  try {
                    const selectedAgent = agents?.find((a) => a.agentId === promptConverterAgentId)
                    const body: any = {
                      prompt_converter_agent_id: promptConverterAgentId || null,
                      auto_prompt_template: autoPromptTemplate || null,
                      selected_prompt_template: selectedPromptTemplate || null,
                      defaultPromptsTimeaout: defaultPromptsTimeaout.toString()
                    }
                    if (promptConverterAgentId && selectedAgent) {
                      body.prompt_converter_gateway_id = selectedAgent.gatewayId
                    } else {
                      body.prompt_converter_gateway_id = null
                    }
                    const res = await fetch('/api/workspaces/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                    if (!res.ok) throw new Error((await res.json()).error || 'Failed to save settings')
                    setPromptTemplatesMessage('Saved!')
                    setTimeout(() => setPromptTemplatesMessage(''), 2000)
                  } catch (error) {
                    console.error('Error saving prompt templates settings:', error)
                    setPromptTemplatesMessage('Error saving')
                    setTimeout(() => setPromptTemplatesMessage(''), 2000)
                  } finally {
                    setPromptTemplatesSaving(false)
                  }
                }}
              >
                {promptTemplatesSaving ? 'Saving...' : promptTemplatesMessage || 'Save Settings'}
              </button>
            </div>

            <div className="flex flex-col gap-2 py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Prompt Converter Agent</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Select an agent to automatically convert prompts using AI. This is used by the Auto Prompt and Auto Format features in tickets.</p>
              </div>
              <select
                className="px-3 py-2 rounded-lg border"
                style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                value={promptConverterAgentId}
                onChange={(e) => setPromptConverterAgentId(e.target.value)}
              >
                <option value="">None selected (will use summarizer agent fallback)</option>
                {agents?.map((agent) => (
                  <option key={agent.agentId} value={agent.agentId}>
                    {agent.agentName} ({agent.gatewayName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Chat Timeout</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Maximum time to wait for AI chat response during prompt conversion (10-600 seconds)</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="600"
                  className="w-20 px-2 py-1 rounded border text-center"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  value={defaultPromptsTimeaout}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 120
                    // Clamp between 10 and 600
                    setDefaultPromptsTimeaout(Math.min(600, Math.max(10, val)))
                  }}
                />
                <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>seconds</span>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <label className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Auto Prompt Template (Optional)</label>
                <button
                  className="px-3 py-1.5 rounded-lg border text-sm transition-colors"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  onClick={() => {
                    setAutoPromptTemplate(DEFAULT_AUTO_TICKET_CONVERTER_TEMPLATE)
                    setAutoPromptTemplateLoadMessage('Default loaded')
                    setTimeout(() => setAutoPromptTemplateLoadMessage(''), 2000)
                  }}
                >
                  {autoPromptTemplateLoadMessage || 'Load Default Template'}
                </button>
              </div>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Custom template for Auto Prompt feature. Leave empty to use default. Variables: {'{$targetText}'}, {'{$promptFormats}'}</p>
              <textarea
                className="w-full px-3 py-2 rounded-lg border font-mono text-sm"
                style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))', minHeight: '150px', fontFamily: 'monospace' }}
                value={autoPromptTemplate}
                onChange={(e) => setAutoPromptTemplate(e.target.value)}
                placeholder="Leave empty for default template..."
              />
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <label className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Selected Prompt Template (Optional)</label>
                <button
                  className="px-3 py-1.5 rounded-lg border text-sm transition-colors"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
                  onClick={() => {
                    setSelectedPromptTemplate(DEFAULT_SELECTED_TICKET_CONVERTER_TEMPLATE)
                    setSelectedPromptTemplateLoadMessage('Default loaded')
                    setTimeout(() => setSelectedPromptTemplateLoadMessage(''), 2000)
                  }}
                >
                  {selectedPromptTemplateLoadMessage || 'Load Default Template'}
                </button>
              </div>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Custom template for specific format conversion. Leave empty to use default. Variables: {'{$targetText}'}, {'{$selectedFormat}'}</p>
              <textarea
                className="w-full px-3 py-2 rounded-lg border font-mono text-sm"
                style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))', minHeight: '150px', fontFamily: 'monospace' }}
                value={selectedPromptTemplate}
                onChange={(e) => setSelectedPromptTemplate(e.target.value)}
                placeholder="Leave empty for default template..."
              />
            </div>

            <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }}>
              <h4 className="font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>How it works</h4>
              <ul className="space-y-1 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                <li>1. Select a Prompt Converter Agent to enable Auto Prompt and Auto Format features</li>
                <li>2. Auto Prompt analyzes your text and automatically selects the best format</li>
                <li>3. Auto Format converts text using a specific selected format</li>
                <li>4. Both features use the same agent but with different prompt templates</li>
                <li>5. If no agent is selected, the system will fall back to the summarizer agent</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'skillsmp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>SkillsMP Integration</h2>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={skillsmpSaving} onClick={async () => {
                setSkillsmpSaving(true)
                setSkillsmpMessage('Saving...')
                try {
                  const res = await fetch('/api/workspaces/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skillsmp_api_key: skillsmpApiKey || null }) })
                  if (!res.ok) throw new Error((await res.json()).error || 'Failed to save settings')
                  setSkillsmpMessage('Saved!')
                  setTimeout(() => setSkillsmpMessage(''), 2000)
                } catch (error) {
                  console.error('Error saving SkillsMP settings:', error)
                  setSkillsmpMessage('Error saving')
                  setTimeout(() => setSkillsmpMessage(''), 2000)
                } finally {
                  setSkillsmpSaving(false)
                }
              }}>
                {skillsmpSaving ? 'Saving...' : skillsmpMessage || 'Save Settings'}
              </button>
            </div>
            <div className="flex flex-col gap-2 py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>SkillsMP API Key</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Enter your SkillsMP API key to enable marketplace search. Get your API key from{' '}
                  <a href="https://skillsmp.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">skillsmp.com</a>
                </p>
              </div>
              <input type="password" className="px-3 py-2 rounded-lg border font-mono text-sm" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }} value={skillsmpApiKey} onChange={(e) => setSkillsmpApiKey(e.target.value)} placeholder="sk_live_..." />
            </div>
            <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }}>
              <h4 className="font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>About SkillsMP</h4>
              <ul className="space-y-1 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                <li>• SkillsMP is a marketplace for AI skills and prompts</li>
                <li>• Browse and import skills directly into your workspace</li>
                <li>• API key is required to search the marketplace</li>
                <li>• Your API key is stored securely in your workspace settings</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(239 68 68)' }}>Danger Zone</h2>
              <button className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSaving}>Delete Workspace</button>
            </div>
            <div className="flex items-center justify-between py-3 border rounded-lg" style={{ borderColor: 'rgb(239 68 68)' }}>
              <div>
                <p className="font-medium text-red-600">Delete Workspace</p>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Permanently delete your workspace and all data</p>
              </div>
              <button className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function SettingsPageContent(props: PageContentProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center" style={{ height: '50vh' }}><div style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</div></div>}>
      <SettingsContent {...props} />
    </Suspense>
  )
}