'use client'

export interface Skill {
  id: string
  workspace_id: string
  skill_name: string
  skill_description: string | null
  skill_data: string
  source: 'custom' | 'skillsmp' | 'imported'
  tags: string | null
  path?: string
  is_content_from_path?: boolean
  github_url?: string
  skill_url?: string
  status_count: number
  created_by_email: string | null
}

export interface SkillsPageContentProps {
  user: any
}