'use client'

interface HeaderProps {
  onAddSkill: () => void
  onBrowseMarketplace: () => void
}

export function Header({ onAddSkill, onBrowseMarketplace }: HeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
          Skills
        </h1>
        <p className="mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
          Manage AI skills that provide context to agents during ticket flow execution
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onBrowseMarketplace}
          className="px-4 py-2 rounded-lg border transition-colors"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
          }}
        >
          🔍 Browse Marketplace
        </button>
        <button
          onClick={onAddSkill}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          + Add Skill
        </button>
      </div>
    </div>
  )
}