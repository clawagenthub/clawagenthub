'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function GeneralSettingsSection() {
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  return (
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
  )
}
