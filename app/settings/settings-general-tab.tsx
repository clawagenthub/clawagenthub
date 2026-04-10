'use client'

interface GeneralTabProps {
  isSaving: boolean
  saveMessage: string
  onSave: () => void
}

export function GeneralTab({ isSaving, saveMessage, onSave }: GeneralTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
          General Settings
        </h2>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving}
          onClick={onSave}
        >
          {isSaving ? 'Saving...' : saveMessage || 'Save Settings'}
        </button>
      </div>

      <div className="flex items-center justify-between border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Notifications</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Manage your notification preferences</p>
        </div>
        <button className="rounded-lg border px-4 py-2" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>
          Configure
        </button>
      </div>

      <div className="flex items-center justify-between border-b py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Theme</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Customize your appearance settings</p>
        </div>
        <button className="rounded-lg border px-4 py-2" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>
          Customize
        </button>
      </div>

      <div className="flex items-center justify-between py-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>Language</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Select your preferred language</p>
        </div>
        <button className="rounded-lg border px-4 py-2" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }}>
          Change
        </button>
      </div>
    </div>
  )
}
