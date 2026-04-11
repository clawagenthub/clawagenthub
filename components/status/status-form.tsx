'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAgents, useStatuses } from '@/lib/query/hooks'
import logger, { logCategories as _logCategories } from '@/lib/logger/index.js'
import { StatusFormProps, Skill, STATUS_COLORS } from '@/lib/types/status-form-types'

export function StatusForm({
  initialName = '',
  initialColor = STATUS_COLORS[0].value,
  initialDescription = '',
  initialPriority = 999,
  initialAgentId = null,
  initialIsFlowIncluded = false,
  initialOnFailedGoto = null,
  initialAskApproveToContinue = false,
  editingStatusId,
  initialSkillIds: _initialSkillIds = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Create Status',
  isEditing = false,
}: StatusFormProps) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)
  const [description, setDescription] = useState(initialDescription)
  const [priority, setPriority] = useState(initialPriority)
  const [agentId, setAgentId] = useState<string | null>(initialAgentId)
  const [customColor, setCustomColor] = useState('')
  const [useCustomColor, setUseCustomColor] = useState(false)
  
  // Flow configuration state
  const [isFlowIncluded, setIsFlowIncluded] = useState(initialIsFlowIncluded)
  const [onFailedGoto, setOnFailedGoto] = useState<string | null>(initialOnFailedGoto)
  const [askApproveToContinue, setAskApproveToContinue] = useState(initialAskApproveToContinue)
  const [isFlowConfigExpanded, setIsFlowConfigExpanded] = useState(false)
  
  // Skills state
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([])
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [skillsSearchTerm, setSkillsSearchTerm] = useState('')
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false)
  const [isLoadingSkills, setIsLoadingSkills] = useState(false)
  const [skillsError, setSkillsError] = useState<string | null>(null)
  
  // Fetch available agents from connected gateways
  const { data: agents = [], isLoading: isLoadingAgents } = useAgents()
  
  // Fetch statuses for on_failed_goto dropdown
  const { data: statuses = [] } = useStatuses()

  const fetchSkills = useCallback(async () => {
    setIsLoadingSkills(true)
    setSkillsError(null)
    try {
      const response = await fetch('/api/skills')
      if (!response.ok) {
        throw new Error('Failed to fetch skills')
      }
      const data = await response.json()
      setAvailableSkills(data.skills || [])
    } catch (error) {
      logger.error('Error fetching skills:', error)
      setSkillsError('Failed to load skills')
    } finally {
      setIsLoadingSkills(false)
    }
  }, [])

  const fetchStatusSkills = useCallback(async () => {
    if (!editingStatusId) return
    try {
      const response = await fetch(`/api/statuses/${editingStatusId}/skills`)
      if (!response.ok) {
        // If status is new or has no skills, that's fine
        setSelectedSkills([])
        return
      }
      const data = await response.json()
      setSelectedSkills(data.skills || [])
    } catch (error) {
      logger.error('Error fetching status skills:', error)
      setSelectedSkills([])
    }
  }, [editingStatusId])

  // Fetch available skills when component mounts or skills section expands
  useEffect(() => {
    if (isSkillsExpanded && availableSkills.length === 0) {
      fetchSkills()
    }
  }, [isSkillsExpanded, availableSkills.length, fetchSkills])

  // Fetch initial skills for editing
  useEffect(() => {
    if (isEditing && editingStatusId) {
      fetchStatusSkills()
    }
  }, [isEditing, editingStatusId, fetchStatusSkills])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: name.trim(),
      color: useCustomColor ? customColor : color,
      description: description.trim() || undefined,
      priority,
      agent_id: agentId,
      is_flow_included: isFlowIncluded,
      on_failed_goto: onFailedGoto,
      ask_approve_to_continue: askApproveToContinue,
      skill_ids: selectedSkills.map(s => s.id),
    })
  }
  
  const handleAddSkill = (skill: Skill) => {
    if (!selectedSkills.find(s => s.id === skill.id)) {
      setSelectedSkills([...selectedSkills, skill])
    }
  }
  
  const handleRemoveSkill = (skillId: string) => {
    setSelectedSkills(selectedSkills.filter(s => s.id !== skillId))
  }
  
  const getFilteredSkills = () => {
    if (!skillsSearchTerm.trim()) {
      return availableSkills.filter(s => !selectedSkills.find(ss => ss.id === s.id))
    }
    const searchLower = skillsSearchTerm.toLowerCase()
    return availableSkills.filter(s =>
      !selectedSkills.find(ss => ss.id === s.id) &&
      (s.skill_name.toLowerCase().includes(searchLower) ||
       (s.skill_description && s.skill_description.toLowerCase().includes(searchLower)) ||
       (s.tags && s.tags.toLowerCase().includes(searchLower)))
    )
  }

  const isCustomColorInPalette = STATUS_COLORS.some((c) => c.value === customColor)

  // Filter out the current status from on_failed_goto options (can't go to itself)
  const gotoStatusOptions = statuses.filter(s => s.id !== editingStatusId)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label
          htmlFor="status-name"
          className="mb-1 block text-sm font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Name *
        </label>
        <input
          id="status-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., To Do, In Progress, Done"
          className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderColor: `rgb(var(--border-color))`,
            color: `rgb(var(--text-primary))`,
            ringColor: 'rgb(var(--accent-primary, 59 130 246))',
          }}
          maxLength={50}
          required
        />
        <p className="mt-1 text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
          {name.length}/50 characters
        </p>
      </div>

      {/* Priority */}
      <div>
        <label
          htmlFor="status-priority"
          className="mb-1 block text-sm font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Priority
        </label>
        <input
          id="status-priority"
          type="number"
          value={priority}
          onChange={(e) => setPriority(Math.max(0, parseInt(e.target.value) || 0))}
          placeholder="999"
          className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderColor: `rgb(var(--border-color))`,
            color: `rgb(var(--text-primary))`,
            ringColor: 'rgb(var(--accent-primary, 59 130 246))',
          }}
          min={0}
          step={1}
        />
        <p className="mt-1 text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
          Lower numbers appear first on the dashboard (1, 2, 3...)
        </p>
      </div>

      {/* Color */}
      <div>
        <label
          htmlFor="status-color"
          className="mb-2 block text-sm font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Color *
        </label>

        {/* Predefined colors */}
        <div className="mb-3 grid grid-cols-6 gap-2">
          {STATUS_COLORS.map((colorOption) => (
            <button
              key={colorOption.value}
              type="button"
              onClick={() => {
                setColor(colorOption.value)
                setUseCustomColor(false)
              }}
              className={`relative h-10 rounded-md transition-all ${
                !useCustomColor && color === colorOption.value
                  ? 'ring-2 ring-offset-2'
                  : ''
              }`}
              style={{
                backgroundColor: colorOption.value,
                ringColor: 'rgb(var(--accent-primary, 59 130 246))',
                ringOffsetColor: 'rgb(var(--bg-primary))',
              }}
              title={colorOption.name}
            >
              {!useCustomColor && color === colorOption.value && (
                <span className="flex h-full items-center justify-center text-white">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Custom color input */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUseCustomColor(!useCustomColor)}
            className="rounded-md border px-3 py-1.5 text-sm transition-colors"
            style={{
              backgroundColor: useCustomColor
                ? `rgb(var(--bg-tertiary))`
                : `rgb(var(--bg-secondary))`,
              borderColor: `rgb(var(--border-color))`,
              color: `rgb(var(--text-primary))`,
            }}
          >
            Custom Color
          </button>
          {useCustomColor && (
            <>
              <input
                type="color"
                value={customColor || color}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-8 w-14 cursor-pointer rounded border"
                style={{ borderColor: `rgb(var(--border-color))` }}
              />
              <input
                type="text"
                value={customColor || color}
                onChange={(e) => {
                  setCustomColor(e.target.value)
                  if (
                    e.target.value.match(/^#[0-9A-Fa-f]{6}$/) &&
                    !isCustomColorInPalette
                  ) {
                    setColor(e.target.value)
                  }
                }}
                placeholder="#000000"
                className="w-24 rounded-md border px-2 py-1 text-sm"
                style={{
                  backgroundColor: `rgb(var(--bg-secondary))`,
                  borderColor: `rgb(var(--border-color))`,
                  color: `rgb(var(--text-primary))`,
                }}
                maxLength={7}
              />
            </>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="status-description"
          className="mb-1 block text-sm font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Description
        </label>
        <textarea
          id="status-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description for this status"
          className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderColor: `rgb(var(--border-color))`,
            color: `rgb(var(--text-primary))`,
            ringColor: 'rgb(var(--accent-primary, 59 130 246))',
            minHeight: '80px',
            resize: 'vertical',
          }}
          maxLength={2500}
        />
        <p className="mt-1 text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
          {description.length}/2500 characters
        </p>
      </div>

      {/* Agent Selection */}
      <div>
        <label
          htmlFor="status-agent"
          className="mb-1 block text-sm font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Assigned Agent (Optional)
        </label>
        <select
          id="status-agent"
          value={agentId ?? ''}
          onChange={(e) => setAgentId(e.target.value || null)}
          disabled={isLoadingAgents}
          className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            borderColor: `rgb(var(--border-color))`,
            color: `rgb(var(--text-primary))`,
            ringColor: 'rgb(var(--accent-primary, 59 130 246))',
          }}
        >
          <option value="">None</option>
          {agents.map((agent) => (
            <option key={`${agent.gatewayId}-${agent.agentId}`} value={agent.agentId}>
              {agent.gatewayName}:{agent.agentName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
          {isLoadingAgents
            ? 'Loading available agents...'
            : agents.length === 0
            ? 'No agents available. Connect a gateway to see agents.'
            : 'Assign this status to a specific agent for future features'}
        </p>
      </div>

      {/* Flow Configuration Section */}
      <div
        className="border rounded-lg overflow-hidden"
        style={{ borderColor: `rgb(var(--border-color))` }}
      >
        <button
          type="button"
          onClick={() => setIsFlowConfigExpanded(!isFlowConfigExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between transition-colors"
          style={{ backgroundColor: `rgb(var(--bg-secondary))` }}
        >
          <span className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
            Flow Configuration
          </span>
          <svg
            className={`w-5 h-5 transition-transform ${isFlowConfigExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isFlowConfigExpanded && (
          <div className="p-4 space-y-4" style={{ backgroundColor: `rgb(var(--bg-primary))` }}>
            {/* Include in default flow */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
                  Include in default flow
                </label>
                <p className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>
                  Add this status to new ticket flows by default
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFlowIncluded}
                  onChange={(e) => setIsFlowIncluded(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className="w-11 h-6 rounded-full transition-colors"
                  style={{
                    backgroundColor: isFlowIncluded ? `rgb(var(--accent-primary, 59 130 246))` : `rgb(var(--border-color))`,
                  }}
                >
                  <div
                    className="absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform"
                    style={{
                      transform: isFlowIncluded ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  ></div>
                </div>
              </label>
            </div>

            {/* On Failed Goto */}
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
                On Failed Goto
              </label>
              <select
                value={onFailedGoto ?? ''}
                onChange={(e) => setOnFailedGoto(e.target.value || null)}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: `rgb(var(--bg-secondary))`,
                  borderColor: `rgb(var(--border-color))`,
                  color: `rgb(var(--text-primary))`,
                }}
              >
                <option value="">None</option>
                {gotoStatusOptions.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
                Which status to transition to if this status fails
              </p>
            </div>

            {/* Ask to approve to continue */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
                  Ask to approve
                </label>
                <p className="text-xs" style={{ color: `rgb(var(--text-secondary))` }}>
                  Require user approval before proceeding from this status
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={askApproveToContinue}
                  onChange={(e) => setAskApproveToContinue(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className="w-11 h-6 rounded-full transition-colors"
                  style={{
                    backgroundColor: askApproveToContinue ? `rgb(var(--accent-primary, 59 130 246))` : `rgb(var(--border-color))`,
                  }}
                >
                  <div
                    className="absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform"
                    style={{
                      transform: askApproveToContinue ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  ></div>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Skills Section */}
      <div
        className="border rounded-lg overflow-hidden"
        style={{ borderColor: `rgb(var(--border-color))` }}
      >
        <button
          type="button"
          onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between transition-colors"
          style={{ backgroundColor: `rgb(var(--bg-secondary))` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
              Skills
            </span>
            {selectedSkills.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
                  color: 'white',
                }}
              >
                {selectedSkills.length}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 transition-transform ${isSkillsExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isSkillsExpanded && (
          <div className="p-4 space-y-4" style={{ backgroundColor: `rgb(var(--bg-primary))` }}>
            {/* Selected Skills List */}
            {selectedSkills.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
                  Attached Skills
                </label>
                <div className="space-y-2">
                  {selectedSkills.map((skill, index) => (
                    <div
                      key={skill.id}
                      className="flex items-start justify-between rounded-md border p-3"
                      style={{
                        backgroundColor: `rgb(var(--bg-secondary))`,
                        borderColor: `rgb(var(--border-color))`,
                      }}
                    >
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `rgba(var(--accent-primary, 59 130 246), 0.1)`,
                              color: `rgb(var(--accent-primary, 59 130 246))`,
                            }}
                          >
                            {index + 1}
                          </span>
                          <span className="font-medium text-sm" style={{ color: `rgb(var(--text-primary))` }}>
                            {skill.skill_name}
                          </span>
                          {skill.source === 'marketplace' && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                color: 'rgb(168, 85, 247)',
                              }}
                            >
                              Marketplace
                            </span>
                          )}
                        </div>
                        {skill.skill_description && (
                          <p className="mt-1 text-xs line-clamp-2" style={{ color: `rgb(var(--text-secondary))`, overflowWrap: 'break-word' }}>
                            {skill.skill_description}
                          </p>
                        )}
                        {skill.tags && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {skill.tags.split(',').slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: `rgb(var(--bg-tertiary))`,
                                  color: `rgb(var(--text-tertiary))`,
                                }}
                              >
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill.id)}
                        className="ml-2 flex-shrink-0 p-1 rounded hover:bg-red-100 transition-colors"
                        style={{ color: 'rgb(239, 68, 68)' }}
                        title="Remove skill"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
                  Skills are injected into agent prompts in priority order during flow execution.
                </p>
              </div>
            )}

            {/* Add Skills */}
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: `rgb(var(--text-primary))` }}>
                Add Skills
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={skillsSearchTerm}
                  onChange={(e) => setSkillsSearchTerm(e.target.value)}
                  onFocus={() => {
                    if (availableSkills.length === 0 && !isLoadingSkills) {
                      fetchSkills()
                    }
                  }}
                  placeholder="Search skills by name, description, or tags..."
                  className="w-full rounded-md border px-3 py-2 pl-10 focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: `rgb(var(--bg-secondary))`,
                    borderColor: `rgb(var(--border-color))`,
                    color: `rgb(var(--text-primary))`,
                    ringColor: 'rgb(var(--accent-primary, 59 130 246))',
                  }}
                />
                <svg
                  className="absolute left-3 top-2.5 w-5 h-5"
                  style={{ color: `rgb(var(--text-tertiary))` }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Skills Dropdown */}
              {skillsSearchTerm.trim() && (
                <div
                  className="mt-2 rounded-md border max-h-60 overflow-y-auto"
                  style={{
                    backgroundColor: `rgb(var(--bg-secondary))`,
                    borderColor: `rgb(var(--border-color))`,
                  }}
                >
                  {isLoadingSkills ? (
                    <div className="p-4 text-center text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
                      Loading skills...
                    </div>
                  ) : skillsError ? (
                    <div className="p-4 text-center text-sm text-red-500">
                      {skillsError}
                    </div>
                  ) : getFilteredSkills().length === 0 ? (
                    <div className="p-4 text-center text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
                      {availableSkills.length === 0
                        ? 'No skills available. Create skills in the Skills tab.'
                        : 'No matching skills found.'}
                    </div>
                  ) : (
                    getFilteredSkills().slice(0, 10).map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => {
                          handleAddSkill(skill)
                          setSkillsSearchTerm('')
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-opacity-50 transition-colors border-b last:border-b-0"
                        style={{
                          borderColor: `rgb(var(--border-color))`,
                          backgroundColor: 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `rgb(var(--bg-tertiary))`
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate" style={{ color: `rgb(var(--text-primary))` }}>
                                {skill.skill_name}
                              </span>
                              {skill.source === 'marketplace' && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{
                                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                    color: 'rgb(168, 85, 247)',
                                  }}
                                >
                                  MP
                                </span>
                              )}
                            </div>
                            {skill.skill_description && (
                              <p className="text-xs truncate mt-0.5" style={{ color: `rgb(var(--text-secondary))`, overflowWrap: 'break-word' }}>
                                {skill.skill_description}
                              </p>
                            )}
                          </div>
                          <svg
                            className="w-5 h-5 flex-shrink-0 ml-2"
                            style={{ color: `rgb(var(--accent-primary, 59 130 246))` }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Quick Add: All Skills (when no search) */}
              {!skillsSearchTerm.trim() && availableSkills.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setIsSkillsExpanded(false)}
                    className="text-sm underline"
                    style={{ color: `rgb(var(--accent-primary, 59 130 246))` }}
                  >
                    Go to Skills tab to create new skills
                  </button>
                  {getFilteredSkills().length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
                        Available skills ({getFilteredSkills().length}):
                      </p>
                      {getFilteredSkills().slice(0, 5).map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => handleAddSkill(skill)}
                          className="block w-full text-left px-2 py-1.5 rounded text-sm hover:opacity-80 transition-colors"
                          style={{
                            backgroundColor: `rgb(var(--bg-secondary))`,
                            color: `rgb(var(--text-primary))`,
                          }}
                        >
                          <span className="font-medium">{skill.skill_name}</span>
                          {skill.skill_description && (
                            <span className="ml-2 text-xs truncate" style={{ color: `rgb(var(--text-secondary))` }}>
                              {skill.skill_description}
                            </span>
                          )}
                        </button>
                      ))}
                      {getFilteredSkills().length > 5 && (
                        <p className="text-xs mt-1" style={{ color: `rgb(var(--text-tertiary))` }}>
                          +{getFilteredSkills().length - 5} more skills...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div
        className="rounded-lg border p-3"
        style={{
          backgroundColor: `rgb(var(--bg-secondary))`,
          borderColor: `rgb(var(--border-color))`,
        }}
      >
        <p className="mb-2 text-xs font-medium" style={{ color: `rgb(var(--text-tertiary))` }}>
          Preview
        </p>
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: useCustomColor ? customColor || color : color }}
          />
          <span
            className="font-medium"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            {name.trim() || 'Status Name'}
          </span>
          <div
            className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: `rgb(var(--bg-tertiary))`,
              color: `rgb(var(--text-secondary))`,
            }}
          >
            {priority}
          </div>
        </div>
        {description.trim() && (
          <p
            className="mt-1 text-sm"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            {description.trim()}
          </p>
        )}
        {/* Flow configuration badges in preview */}
        {(isFlowIncluded || onFailedGoto || askApproveToContinue || selectedSkills.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {isFlowIncluded && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(156, 163, 175, 0.2)',
                  color: 'rgb(var(--text-secondary))',
                }}
              >
                In Flow
              </span>
            )}
            {onFailedGoto && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(249, 115, 22, 0.1)',
                  color: 'rgb(249, 115, 22)',
                }}
              >
                On Fail → {gotoStatusOptions.find(s => s.id === onFailedGoto)?.name || 'Unknown'}
              </span>
            )}
            {askApproveToContinue && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.1)',
                  color: 'rgb(234, 179, 8)',
                }}
              >
                Approval
              </span>
            )}
            {selectedSkills.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'rgb(59, 130, 246)',
                }}
              >
                {selectedSkills.length} Skill{selectedSkills.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md px-4 py-2 font-medium transition-colors"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            color: `rgb(var(--text-primary))`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgb(var(--bg-tertiary))`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="rounded-md px-4 py-2 font-medium text-white transition-colors disabled:opacity-50"
          style={{
            backgroundColor: `rgb(var(--accent-primary, 59 130 246))`,
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting && name.trim()) {
              e.currentTarget.style.backgroundColor = 'rgb(37, 99, 235)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgb(var(--accent-primary, 59 130 246))`
          }}
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
