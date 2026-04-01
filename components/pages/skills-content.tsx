'use client'

import { useState, useEffect } from 'react'
import { useNavigation } from '@/lib/contexts/navigation-context'

interface Skill {
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

interface SkillsPageContentProps {
  user: any
}

export function SkillsPageContent({ user }: SkillsPageContentProps) {
  const { isActive } = useNavigation()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [saveMessage, setSaveMessage] = useState('')

  // Fetch skills
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

  const handleEditSkill = async (skill: Skill) => {
    // If skill uses file-based content, fetch full details to get latest file content
    if (skill.is_content_from_path) {
      try {
        const res = await fetch(`/api/skills/${skill.id}`)
        if (res.ok) {
          const data = await res.json()
          setEditingSkill(data.skill)
        } else {
          // Fallback to list data if fetch fails
          setEditingSkill(skill)
        }
      } catch (error) {
        console.error('Error fetching skill details:', error)
        // Fallback to list data if fetch fails
        setEditingSkill(skill)
      }
    } else {
      setEditingSkill(skill)
    }
    setShowModal(true)
  }

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'custom': return 'bg-blue-100 text-blue-800'
      case 'skillsmp': return 'bg-purple-100 text-purple-800'
      case 'imported': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const parseTags = (tagsJson: string | null) => {
    if (!tagsJson) return []
    try {
      return JSON.parse(tagsJson)
    } catch {
      return []
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
            onClick={() => setShowMarketplaceModal(true)}
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
            onClick={() => {
              setEditingSkill(null)
              setShowModal(true)
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + Add Skill
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search skills by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          onChange={(e) => setSourceFilter(e.target.value)}
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

      {/* Skills Grid */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'rgb(var(--text-secondary))' }}>
          Loading skills...
        </div>
      ) : skills.length === 0 ? (
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
                onClick={() => {
                  setEditingSkill(null)
                  setShowModal(true)
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                + Create Skill
              </button>
              <button
                onClick={() => setShowMarketplaceModal(true)}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                borderColor: 'rgb(var(--border-color))',
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                  {skill.skill_name}
                </h3>
                <span className={`text-xs px-2 py-1 rounded ${getSourceBadgeColor(skill.source)}`}>
                  {skill.source}
                </span>
              </div>
              
              {skill.skill_description && (
                <p className="text-sm mb-3 line-clamp-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                  {skill.skill_description}
                </p>
              )}

              {skill.tags && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {parseTags(skill.tags).slice(0, 3).map((tag: string, i: number) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded"
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

              <div className="flex items-center justify-between text-xs pt-3 border-t" style={{ borderColor: 'rgb(var(--border-color))' }}>
                <span style={{ color: 'rgb(var(--text-secondary))' }}>
                  📊 {skill.status_count} {skill.status_count === 1 ? 'status' : 'statuses'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditSkill(skill)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSkill(skill.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skills Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
          >
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
                {editingSkill ? 'Edit Skill' : 'Add New Skill'}
              </h2>

              <SkillForm
                skill={editingSkill}
                onSave={async (data) => {
                  try {
                    const url = editingSkill
                      ? `/api/skills/${editingSkill.id}`
                      : '/api/skills'
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
                }}
                onCancel={() => {
                  setShowModal(false)
                  setEditingSkill(null)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Marketplace Modal */}
      {showMarketplaceModal && (
        <SkillsMarketplaceModal
          onClose={() => setShowMarketplaceModal(false)}
          onImport={async (skillData) => {
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
          }}
        />
      )}
    </div>
  )
}

// Skill Form Component
function SkillForm({
  skill,
  onSave,
  onCancel,
}: {
  skill: Skill | null
  onSave: (data: any) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    skill_name: skill?.skill_name || '',
    skill_description: skill?.skill_description || '',
    skill_data: skill?.skill_data || '',
    tags: skill?.tags || '',
  })

  // Update form data when skill prop changes (for file-based skills)
  useEffect(() => {
    if (skill) {
      setFormData({
        skill_name: skill.skill_name || '',
        skill_description: skill.skill_description || '',
        skill_data: skill.skill_data || '',
        tags: skill.tags || '',
      })
    }
  }, [skill])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.skill_name.trim() || !formData.skill_data.trim()) {
      alert('Name and content are required')
      return
    }
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
          Skill Name *
        </label>
        <input
          type="text"
          value={formData.skill_name}
          onChange={(e) => setFormData({ ...formData, skill_name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
          }}
          placeholder="e.g., React Best Practices"
        />
      </div>

      <div>
        <label className="block font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
          Description
        </label>
        <input
          type="text"
          value={formData.skill_description}
          onChange={(e) => setFormData({ ...formData, skill_description: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
          }}
          placeholder="Brief description of what this skill does"
        />
      </div>

      <div>
        <label className="block font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
          Content (Markdown) *
        </label>
        <textarea
          value={formData.skill_data}
          onChange={(e) => setFormData({ ...formData, skill_data: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border font-mono text-sm"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
            minHeight: '300px',
            fontFamily: 'monospace',
          }}
          placeholder="# Your Skill Name

## Overview
Brief description of what this skill does.

## Instructions
Step-by-step instructions for the AI agent..."
        />
      </div>

      <div>
        <label className="block font-medium mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
          }}
          placeholder="react, frontend, best-practices"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {skill ? 'Update' : 'Create'} Skill
        </button>
      </div>
    </form>
  )
}

// Skills Marketplace Modal Component
function SkillsMarketplaceModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (skill: any) => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Check if API key is configured when modal opens
  useEffect(() => {
    async function checkApiKey() {
      try {
        const res = await fetch('/api/workspaces/settings')
        if (res.ok) {
          const data = await res.json()
          setHasApiKey(!!data.skillsmp_api_key)
        }
      } catch (error) {
        console.error('Error checking API key:', error)
        setHasApiKey(false)
      }
    }
    checkApiKey()
  }, [])

  const handleSearch = async () => {
    if (!search.trim()) return

    setLoading(true)
    setErrorMessage('')
    try {
      const res = await fetch(`/api/skills/marketplace?q=${encodeURIComponent(search)}`)
      const data = await res.json()
      
      if (res.ok) {
        setResults(data.skills || [])
        if (data.message) {
          setErrorMessage(data.message)
        }
      } else {
        setErrorMessage(data.message || 'Failed to search marketplace')
        setResults([])
      }
    } catch (error) {
      console.error('Error searching marketplace:', error)
      setErrorMessage('Failed to connect to marketplace')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = (skill: any) => {
    // Open skill URL in new tab if available
    if (skill.url) {
      window.open(skill.url, '_blank', 'noopener,noreferrer')
    } else {
      // Fallback to modal preview if no URL
      setPreview(skill)
    }
  }

  const handleImport = (skill: any) => {
    onImport({
      external_id: skill.id,
      skill_name: skill.name,
      skill_description: skill.description,
      skill_data: skill.content,
      tags: skill.tags,
      github_url: skill.githubUrl,
      skill_url: skill.url,
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
              Browse Skills Marketplace
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              style={{ color: 'rgb(var(--text-secondary))' }}
            >
              ✕
            </button>
          </div>

          {/* API Key Warning */}
          {hasApiKey === false && (
            <div
              className="mb-4 p-4 rounded-lg border-l-4"
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                borderLeftColor: 'rgb(251, 191, 36)',
                borderColor: 'rgba(251, 191, 36, 0.3)',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold mb-1" style={{ color: 'rgb(251, 191, 36)' }}>
                    SkillsMP API Key Not Configured
                  </p>
                  <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                    To search the SkillsMP marketplace, you need to configure your API key.{' '}
                    <a
                      href="/settings"
                      className="text-blue-600 hover:underline font-medium"
                      onClick={(e) => {
                        e.preventDefault()
                        window.location.href = '/settings'
                      }}
                    >
                      Go to Settings → SkillsMP
                    </a>{' '}
                    to add your API key.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div
              className="mb-4 p-3 rounded-lg border"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <p className="text-sm" style={{ color: 'rgb(239, 68, 68)' }}>
                {errorMessage}
              </p>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-2 rounded-lg border"
              style={{
                backgroundColor: 'rgb(var(--bg-secondary))',
                borderColor: 'rgb(var(--border-color))',
                color: 'rgb(var(--text-primary))',
              }}
              placeholder="Search for skills (e.g., react, typescript, api design)..."
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Results */}
          <div className="space-y-3">
            {results.length === 0 && !loading && search && (
              <div className="text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>
                No results found. Try different search terms.
              </div>
            )}
            {results.map((skill) => (
              <div
                key={skill.id}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                      {skill.name}
                    </h3>
                    <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {skill.description}
                    </p>
                    {skill.tags && skill.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {skill.tags.map((tag: string, i: number) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded"
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
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handlePreview(skill)}
                      className="px-3 py-1 rounded border text-sm"
                      style={{
                        backgroundColor: 'rgb(var(--bg-primary))',
                        borderColor: 'rgb(var(--border-color))',
                        color: 'rgb(var(--text-primary))',
                      }}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleImport(skill)}
                      className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Import
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div
            className="rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6"
            style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
                {preview.name}
              </h2>
              <button
                onClick={() => setPreview(null)}
                className="text-gray-500 hover:text-gray-700"
                style={{ color: 'rgb(var(--text-secondary))' }}
              >
                ✕
              </button>
            </div>
            <p className="mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>
              {preview.description}
            </p>
            <pre className="p-4 rounded-lg overflow-x-auto text-sm" style={{ backgroundColor: 'rgb(var(--bg-secondary))', color: 'rgb(var(--text-primary))' }}>
              {preview.content}
            </pre>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-color))',
                  color: 'rgb(var(--text-primary))',
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleImport(preview)
                  setPreview(null)
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Import Skill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
