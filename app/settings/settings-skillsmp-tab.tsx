'use client'

import { Button } from '@/components/ui/button'

interface SkillsmpTabProps {
  skillsmpApiKey: string
  skillsmpSaving: boolean
  skillsmpMessage: string
  onApiKeyChange: (v: string) => void
  onSave: () => void
}

export function SkillsmpTab({
  skillsmpApiKey,
  skillsmpSaving,
  skillsmpMessage,
  onApiKeyChange,
  onSave,
}: SkillsmpTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>SkillsMP Integration</h2>
        <Button onClick={onSave} disabled={skillsmpSaving}>
          {skillsmpSaving ? 'Saving...' : skillsmpMessage || 'Save Settings'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>SkillsMP API Key</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Enter your SkillsMP API key to enable marketplace search. Get your API key from{' '}
            <a href="https://skillsmp.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              skillsmp.com
            </a>
          </p>
        </div>
        <input
          type="password"
          className="rounded-lg border px-3 py-2 font-mono text-sm"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}
          value={skillsmpApiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="sk_live_..."
        />
      </div>

      <div className="mt-4 rounded-lg border p-4" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))' }}>
        <h4 className="mb-2 font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>About SkillsMP</h4>
        <ul className="space-y-1 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
          <li>• SkillsMP is a marketplace for AI skills and prompts</li>
          <li>• Browse and import skills directly into your workspace</li>
          <li>• API key is required to search the marketplace</li>
          <li>• Your API key is stored securely in your workspace settings</li>
        </ul>
      </div>
    </div>
  )
}
