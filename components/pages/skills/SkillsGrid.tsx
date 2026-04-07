'use client'

import { Skill } from './types'
import { SkillCard } from './SkillCard'
import { EmptyState } from './EmptyState'

interface SkillsGridProps {
  skills: Skill[]
  loading: boolean
  search: string
  sourceFilter: string
  onEdit: (s: Skill) => void
  onDelete: (id: string) => void
  onAddSkill: () => void
  onBrowseMarketplace: () => void
}

export function SkillsGrid({
  skills,
  loading,
  search,
  sourceFilter,
  onEdit,
  onDelete,
  onAddSkill,
  onBrowseMarketplace,
}: SkillsGridProps) {
  if (loading) {
    return (
      <div className="text-center py-12" style={{ color: 'rgb(var(--text-secondary))' }}>
        Loading skills...
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        search={search}
        sourceFilter={sourceFilter}
        onAddSkill={onAddSkill}
        onBrowseMarketplace={onBrowseMarketplace}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}