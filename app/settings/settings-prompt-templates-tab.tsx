'use client'

import { Button } from '@/components/ui/button'
import type { Agent } from '@/lib/query/hooks/useChat'

interface PromptTemplatesTabProps {
  promptConverterAgentId: string
  autoPromptTemplate: string
  selectedPromptTemplate: string
  agents: Agent[] | undefined
  agentsLoading: boolean
  promptTemplatesSaving: boolean
  promptTemplatesMessage: string
  onAgentChange: (id: string) => void
  onAutoTemplateChange: (v: string) => void
  onSelectedTemplateChange: (v: string) => void
  onSave: () => void
}

export function PromptTemplatesTab({
  promptConverterAgentId,
  autoPromptTemplate,
  selectedPromptTemplate,
  agents,
  agentsLoading,
  promptTemplatesSaving,
  promptTemplatesMessage,
  onAgentChange,
  onAutoTemplateChange,
  onSelectedTemplateChange,
  onSave,
}: PromptTemplatesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Prompt Templates Settings</h2>
        <Button onClick={onSave} disabled={promptTemplatesSaving || agentsLoading}>
          {promptTemplatesSaving ? 'Saving...' : promptTemplatesMessage || 'Save Settings'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Prompt Converter Agent</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Select an agent for Auto Prompt and Auto Format conversion features. If empty, the workspace summarizer agent is used as fallback.</p>
        </div>
        <select
          className="rounded-lg border px-3 py-2"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
          value={promptConverterAgentId}
          onChange={(e) => onAgentChange(e.target.value)}
        >
          <option value="">None selected (use summarizer fallback)</option>
          {agents?.map((agent) => (
            <option key={agent.agentId} value={agent.agentId}>
              {agent.agentName} ({agent.gatewayName})
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2">
        <label className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Auto Prompt Template (Optional)</label>
        <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Leave empty to use the default template. Variables: {'{$targetText}'}, {'{$promptFormats}'}</p>
        <textarea
          className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))', minHeight: '150px', fontFamily: 'monospace' }}
          value={autoPromptTemplate}
          onChange={(e) => onAutoTemplateChange(e.target.value)}
          placeholder="Leave empty for default template..."
        />
      </div>

      <div className="mt-4 space-y-2">
        <label className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Selected Prompt Template (Optional)</label>
        <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Leave empty to use the default template. Variables: {'{$targetText}'}, {'{$selectedFormat}'}</p>
        <textarea
          className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))', minHeight: '150px', fontFamily: 'monospace' }}
          value={selectedPromptTemplate}
          onChange={(e) => onSelectedTemplateChange(e.target.value)}
          placeholder="Leave empty for default template..."
        />
      </div>

      <div className="mt-4 rounded-lg border p-4" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }}>
        <h4 className="mb-2 font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>How it works</h4>
        <ul className="space-y-1 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
          <li>1. Auto Prompt builds a conversion instruction from the description and all available formats.</li>
          <li>2. Auto Format builds a similar conversion instruction from the current ticket description.</li>
          <li>3. The selected agent handles these conversion requests when backend integration uses these settings.</li>
          <li>4. Custom templates let you override the default converter prompt text.</li>
        </ul>
      </div>
    </div>
  )
}
