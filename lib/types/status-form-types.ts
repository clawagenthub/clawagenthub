// status-form-types.ts - Status form type definitions for Fast Refresh compliance

export interface StatusFormProps {
  initialName?: string
  initialColor?: string
  initialDescription?: string
  initialPriority?: number
  initialAgentId?: string | null
  initialIsFlowIncluded?: boolean
  initialOnFailedGoto?: string | null
  initialAskApproveToContinue?: boolean
  editingStatusId?: string
  initialSkillIds?: string[]
  onSubmit: (data: {
    name: string
    color: string
    description?: string
    priority?: number
    agent_id?: string | null
    is_flow_included?: boolean
    on_failed_goto?: string | null
    ask_approve_to_continue?: boolean
    skill_ids?: string[]
  }) => void
  isEditing?: boolean
  onCancel: () => void
  isSubmitting?: boolean
  submitLabel?: string
}

export interface Skill {
  id: string
  skill_name: string
  skill_description: string | null
  tags: string | null
  source: string
}

// Predefined color palette for status colors
export const STATUS_COLORS = [
  { name: 'Gray', value: '#6B7280' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#A855F7' },
]
