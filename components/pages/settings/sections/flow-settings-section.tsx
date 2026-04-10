'use client'

interface FlowSettingsSectionProps {
  flowPromptTemplate: string
  setFlowPromptTemplate: (template: string) => void
  flowTemplateLoading: boolean
}

export function FlowSettingsSection({
  flowPromptTemplate,
  setFlowPromptTemplate,
  flowTemplateLoading,
}: FlowSettingsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
          Flow Prompt Template
        </h2>
        <button
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          onClick={async () => {
            try {
              const res = await fetch('/api/workspaces/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flow_prompt_template: flowPromptTemplate }),
              })
              if (!res.ok) throw new Error('Failed to save')
            } catch (error) {
              console.error('Error saving flow template:', error)
            }
          }}
        >
          Save Template
        </button>
      </div>
      <div className="flex flex-col gap-2 py-3 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Flow Prompt</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Custom template for flow execution. Leave empty for default.
          </p>
        </div>
        <textarea
          className="w-full px-3 py-2 rounded-lg border font-mono text-sm"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
            minHeight: '200px',
            fontFamily: 'monospace',
          }}
          value={flowPromptTemplate}
          onChange={(e) => setFlowPromptTemplate(e.target.value)}
          placeholder="Enter flow prompt template..."
          disabled={flowTemplateLoading}
        />
      </div>
    </div>
  )
}
