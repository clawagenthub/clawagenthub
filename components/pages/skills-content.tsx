'use client'

import { useState, useEffect } from 'react'
import { useNavigation } from '@/lib/contexts/navigation-context'
import { Skill, SkillsPageContentProps } from './skills/types'
import { Header } from './skills/Header'
import { Filters } from './skills/Filters'
import { SkillsGrid } from './skills/SkillsGrid'
import { SkillModal } from './skills/SkillModal'
import { SkillsMarketplaceModal } from './skills/SkillsMarketplaceModal'

export function SkillsPageContent({ user: _user }: SkillsPageContentProps) {
  const { isActive: _isActive } = useNavigation()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)

  const fetchSkills = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (sourceFilter) params.set('source', sourceFilter)

      const res = await fetch(`/api/skills?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setSkills(data.skills || [])
      }
    } catch (error) {
      console.error('Error fetching skills:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSkills()
  }, [search, sourceFilter])

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm('Are you sure you want to delete this skill?')) return
    try {
      const res = await fetch(`/api/skills/${skillId}`, { method: 'DELETE' })
      if (res.ok) {
        setSkills(skills.filter(s => s.id !== skillId))
      }
    } catch (error) {
      console.error('Error deleting skill:', error)
    }
  }

  const handleEditSkill = (skill: Skill) => {
    setEditingSkill(skill.is_content_from_path ? skill : skill)
    setShowModal(true)
  }

  const handleSaveSkill = async (data: any) => {
    try {
      const url = editingSkill ? `/api/skills/${editingSkill.id}` : '/api/skills'
      const method = editingSkill ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        setShowModal(false)
        setEditingSkill(null)
        fetchSkills()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to save skill')
      }
    } catch (error) {
      console.error('Error saving skill:', error)
      alert('Failed to save skill')
    }
  }

  const handleImportFromMarketplace = async (skillData: any) => {
    try {
      const res = await fetch('/api/skills/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skillData),
      })

      if (res.ok) {
        setShowMarketplaceModal(false)
        fetchSkills()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to import skill')
      }
    } catch (error) {
      console.error('Error importing skill:', error)
      alert('Failed to import skill')
    }
  }

  return (
    <div className="space-y-6">
      <Header
        onAddSkill={() => {
          setEditingSkill(null)
          setShowModal(true)
        }}
        onBrowseMarketplace={() => setShowMarketplaceModal(true)}
      />
      <Filters
        search={search}
        onSearchChange={setSearch}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
      />
      <SkillsGrid
        skills={skills}
        loading={loading}
        search={search}
        sourceFilter={sourceFilter}
        onEdit={handleEditSkill}
        onDelete={handleDeleteSkill}
        onAddSkill={() => {
          setEditingSkill(null)
          setShowModal(true)
        }}
        onBrowseMarketplace={() => setShowMarketplaceModal(true)}
      />
      {showModal && (
        <SkillModal
          skill={editingSkill}
          onSave={handleSaveSkill}
          onClose={() => {
            setShowModal(false)
            setEditingSkill(null)
          }}
        />
      )}
      {showMarketplaceModal && (
        <SkillsMarketplaceModal
          onClose={() => setShowMarketplaceModal(false)}
          onImport={handleImportFromMarketplace}
        />
      )}
    </div>
  )
}