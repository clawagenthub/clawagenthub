import { Skill } from './types'
import { getSourceBadgeColor, parseTags } from './utils'

interface SkillCardProps {
  skill: Skill
  onEdit: (skill: Skill) => void
  onDelete: (skillId: string) => void
}

export function SkillCard({ skill, onEdit, onDelete }: SkillCardProps) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'rgb(var(--bg-secondary))',
        borderColor: 'rgb(var(--border-color))',
      }}
    >
      <div className="mb-2 flex items-start justify-between">
        <h3
          className="font-semibold"
          style={{ color: 'rgb(var(--text-primary))' }}
        >
          {skill.skill_name}
        </h3>
        <span
          className={`rounded px-2 py-1 text-xs ${getSourceBadgeColor(skill.source)}`}
        >
          {skill.source}
        </span>
      </div>

      {skill.skill_description && (
        <p
          className="mb-3 line-clamp-2 text-sm"
          style={{ color: 'rgb(var(--text-secondary))' }}
        >
          {skill.skill_description}
        </p>
      )}

      {skill.tags && (
        <div className="mb-3 flex flex-wrap gap-1">
          {parseTags(skill.tags)
            .slice(0, 3)
            .map((tag: string, i: number) => (
              <span
                key={i}
                className="rounded px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: 'rgb(var(--bg-primary))',
                  color: 'rgb(var(--text-secondary))',
                }}
              >
                {tag}
              </span>
            ))}
        </div>
      )}

      <div
        className="flex items-center justify-between border-t pt-3 text-xs"
        style={{ borderColor: 'rgb(var(--border-color))' }}
      >
        <span style={{ color: 'rgb(var(--text-secondary))' }}>
          📊 {skill.status_count}{' '}
          {skill.status_count === 1 ? 'status' : 'statuses'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(skill)}
            className="text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(skill.id)}
            className="text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
