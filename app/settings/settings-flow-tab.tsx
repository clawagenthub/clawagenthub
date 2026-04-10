'use client'

import { Button } from '@/components/ui/button'

interface FlowTabProps {
  flowPromptTemplate: string
  flowTemplateLoading: boolean
  isSaving: boolean
  saveMessage: string
  onTemplateChange: (v: string) => void
  onSave: () => void
}

export function FlowTab({
  flowPromptTemplate,
  flowTemplateLoading,
  isSaving,
  saveMessage,
  onTemplateChange,
  onSave,
}: FlowTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Flow Settings</h2>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : saveMessage || 'Save Template'}
        </Button>
      </div>

      {flowTemplateLoading ? (
        <div className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading template...</div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Custom Prompt Template</label>
            <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Customize the prompt sent to agents during ticket flow execution. Leave empty to use the default template.</p>
            <textarea
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))', minHeight: '400px', fontFamily: 'monospace' }}
              value={flowPromptTemplate}
              onChange={(e) => onTemplateChange(e.target.value)}
              placeholder="Enter custom template or leave empty for default..."
            />
          </div>

          <VariableReference />
        </>
      )}
    </div>
  )
}

function VariableReference() {
  const variables = [
    { var: '{$ticketId}', desc: 'Ticket ID' },
    { var: '{$ticketNumber}', desc: 'Ticket number' },
    { var: '{$ticketTitle}', desc: 'Ticket title' },
    { var: '{$ticketDescription}', desc: 'Ticket description' },
    { var: '{$currentStatusId}', desc: 'Current status ID' },
    { var: '{$currentStatusName}', desc: 'Current status name' },
    { var: '{$currentStatusDescription}', desc: 'Status description' },
    { var: '{$agentId}', desc: 'Agent ID' },
    { var: '{$statusInstructions}', desc: 'Status instructions' },
    { var: '{$commentsJson}', desc: 'Comments JSON' },
    { var: '{$ticketJson}', desc: 'Ticket JSON' },
    { var: '{$workspaceId}', desc: 'Workspace ID' },
  ]

  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }}>
      <h4 className="mb-3 font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Available Variables</h4>
      <p className="mb-3 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Use these variables in your template. They will be replaced with actual values when the agent is triggered.</p>
      <div className="grid grid-cols-2 gap-3">
        {variables.map(({ var: v, desc }) => (
          <div key={v}>
            <code className="rounded px-2 py-1 text-xs" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>{v}</code>
            <span className="ml-2 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
