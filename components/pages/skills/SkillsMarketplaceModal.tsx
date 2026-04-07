'use client'

import { useState, useEffect } from 'react'

interface SkillsMarketplaceModalProps {
  onClose: () => void
  onImport: (skill: any) => void
}

export function SkillsMarketplaceModal({ onClose, onImport }: SkillsMarketplaceModalProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function checkApiKey() {
      try {
        const res = await fetch('/api/workspaces/settings')
        if (res.ok) {
          const data = await res.json()
          setHasApiKey(!!data.skillsmp_api_key)
        }
      } catch {
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
        if (data.message) setErrorMessage(data.message)
      } else {
        setErrorMessage(data.message || 'Failed to search marketplace')
        setResults([])
      }
    } catch {
      setErrorMessage('Failed to connect to marketplace')
      setResults([])
    } finally {
      setLoading(false)
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

  const inputStyle = {
    backgroundColor: 'rgb(var(--bg-secondary))',
    borderColor: 'rgb(var(--border-color))',
    color: 'rgb(var(--text-primary))',
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'rgb(var(--bg-primary))' }}
      >
        <div className="p-6">
          <ModalHeader title="Browse Skills Marketplace" onClose={onClose} />
          <ApiKeyWarning hasApiKey={hasApiKey} />
          {errorMessage && <ErrorMessage message={errorMessage} />}
          <SearchBar search={search} onSearchChange={setSearch} onSearch={handleSearch} loading={loading} inputStyle={inputStyle} />
          <SearchResults results={results} loading={loading} search={search} inputStyle={inputStyle} onPreview={handleImport} onImport={handleImport} />
        </div>
      </div>
      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} onImport={handleImport} />}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h2>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-700" style={{ color: 'rgb(var(--text-secondary))' }}>✕</button>
    </div>
  )
}

function ApiKeyWarning({ hasApiKey }: { hasApiKey: boolean | null }) {
  if (hasApiKey !== false) return null
  return (
    <div className="mb-4 p-4 rounded-lg border-l-4" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderLeftColor: 'rgb(251, 191, 36)', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <p className="font-semibold mb-1" style={{ color: 'rgb(251, 191, 36)' }}>SkillsMP API Key Not Configured</p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            To search the SkillsMP marketplace, you need to configure your API key.{' '}
            <a href="/settings" className="text-blue-600 hover:underline font-medium" onClick={(e) => { e.preventDefault(); window.location.href = '/settings' }}>Go to Settings → SkillsMP</a> to add your API key.
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mb-4 p-3 rounded-lg border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
      <p className="text-sm" style={{ color: 'rgb(239, 68, 68)' }}>{message}</p>
    </div>
  )
}

function SearchBar({ search, onSearchChange, onSearch, loading, inputStyle }: {
  search: string; onSearchChange: (v: string) => void; onSearch: () => void; loading: boolean; inputStyle: any
}) {
  return (
    <div className="flex gap-3 mb-6">
      <input
        type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && onSearch()}
        className="flex-1 px-4 py-2 rounded-lg border" style={inputStyle}
        placeholder="Search for skills (e.g., react, typescript, api design)..."
      />
      <button onClick={onSearch} disabled={loading} className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
        {loading ? 'Searching...' : 'Search'}
      </button>
    </div>
  )
}

function SearchResults({ results, loading, search, inputStyle, onPreview, onImport }: {
  results: any[]; loading: boolean; search: string; inputStyle: any; onPreview: (s: any) => void; onImport: (s: any) => void
}) {
  return (
    <div className="space-y-3">
      {results.length === 0 && !loading && search && (
        <div className="text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>No results found. Try different search terms.</div>
      )}
      {results.map((skill) => (
        <div key={skill.id} className="p-4 rounded-lg border" style={inputStyle}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{skill.name}</h3>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>{skill.description}</p>
              {skill.tags && skill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {skill.tags.map((tag: string, i: number) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgb(var(--bg-primary))', color: 'rgb(var(--text-secondary))' }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 ml-4">
              <button onClick={() => onPreview(skill)} className="px-3 py-1 rounded border text-sm" style={inputStyle}>Preview</button>
              <button onClick={() => onImport(skill)} className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Import</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface PreviewModalProps { preview: any; onClose: () => void; onImport: (skill: any) => void }

export function PreviewModal({ preview, onClose, onImport }: PreviewModalProps) {
  const inputStyle = { backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-primary))' }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div className="rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{preview.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" style={{ color: 'rgb(var(--text-secondary))' }}>✕</button>
        </div>
        <p className="mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>{preview.description}</p>
        <pre className="p-4 rounded-lg overflow-x-auto text-sm" style={{ backgroundColor: 'rgb(var(--bg-secondary))', color: 'rgb(var(--text-primary))' }}>{preview.content}</pre>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border" style={inputStyle}>Close</button>
          <button onClick={() => { onImport(preview); onClose() }} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Import Skill</button>
        </div>
      </div>
    </div>
  )
}