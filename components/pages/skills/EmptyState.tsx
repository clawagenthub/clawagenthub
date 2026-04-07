'use client'

interface EmptyStateProps {
  search: string
  sourceFilter: string
  onAddSkill: () => void
  onBrowseMarketplace: () => void
}

export function EmptyState({ search, sourceFilter, onAddSkill, onBrowseMarketplace }: EmptyStateProps) {
  return (
    <div className="text-center py-12" style={{ color: 'rgb(var(--text-secondary))' }}>
      <div className="text-4xl mb-4">🎯</div>
      <h3 className="text-lg font-semibold mb-2">No skills found</h3>
      <p className="mb-4">
        {search || sourceFilter
          ? 'Try adjusting your filters or search terms'
          : 'Get started by adding your first skill or browsing the marketplace'}
      </p>
      {!search && !sourceFilter && (
        <div className="flex gap-3 justify-center">
          <button
            onClick={onAddSkill}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + Create Skill
          </button>
          <button
            onClick={onBrowseMarketplace}
            className="px-4 py-2 rounded-lg border"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
            }}
          >
            Browse Marketplace
          </button>
        </div>
      )}
    </div>
  )
}