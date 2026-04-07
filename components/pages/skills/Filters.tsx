'use client'

interface FiltersProps {
  search: string
  onSearchChange: (v: string) => void
  sourceFilter: string
  onSourceFilterChange: (v: string) => void
}

export function Filters({ search, onSearchChange, sourceFilter, onSourceFilterChange }: FiltersProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <input
          type="text"
          placeholder="Search skills by name or description..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
          }}
        />
      </div>
      <select
        value={sourceFilter}
        onChange={(e) => onSourceFilterChange(e.target.value)}
        className="px-4 py-2 rounded-lg border"
        style={{
          backgroundColor: 'rgb(var(--bg-secondary))',
          borderColor: 'rgb(var(--border-color))',
          color: 'rgb(var(--text-primary))',
        }}
      >
        <option value="">All Sources</option>
        <option value="custom">Custom</option>
        <option value="skillsmp">SkillsMP</option>
        <option value="imported">Imported</option>
      </select>
    </div>
  )
}