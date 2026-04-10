'use client'

import React, { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import logger, { logCategories as _logCategories } from '@/lib/logger/index.js'


interface Status {
  id: string
  name: string
  color: string
  default_agent_id?: string | null
  default_on_failed_goto?: string | null
  default_ask_approve_to_continue?: boolean
}

interface FlowConfig {
  id?: string
  status_id: string
  flow_order: number
  agent_id?: string | null
  on_failed_goto?: string | null
  ask_approve_to_continue?: boolean
  instructions_override?: string
  is_included?: boolean
}

interface StatusFlowConfigItem {
  status: Status
  config: FlowConfig
}

interface StatusFlowBuilderProps {
  statuses: Status[]
  initialConfigs?: FlowConfig[]
  availableAgents?: Array<{ id: string; name: string }>
  onChange: (configs: FlowConfig[]) => void
  disabled?: boolean
}

function SortableItem({
  id,
  status,
  config,
  onConfigChange,
  availableAgents,
  allStatuses,
  disabled,
}: {
  id: string
  status: Status
  config: FlowConfig
  onConfigChange: (config: FlowConfig) => void
  availableAgents?: Array<{ id: string; name: string }>
  allStatuses: Status[]
  disabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      ref={setNodeRef}
      className="rounded-lg border p-3 mb-2"
      style={{
        ...style,
        backgroundColor: `rgb(var(--bg-secondary))`,
        borderColor: `rgb(var(--border-color))`,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 transition-colors"
          style={{ color: `rgb(var(--text-tertiary))` }}
          disabled={disabled}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = `rgb(var(--text-primary))`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = `rgb(var(--text-tertiary))`
          }}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </button>

        {/* Status Badge */}
        <div
          className="px-3 py-1 rounded text-sm font-medium flex-shrink-0"
          style={{ backgroundColor: status.color + '20', color: status.color }}
        >
          {status.name}
        </div>

        {/* Quick Info */}
        <div className="flex-1 flex items-center gap-4 text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
          {config.agent_id && (
            <span>Agent: {availableAgents?.find(a => a.id === config.agent_id)?.name || config.agent_id}</span>
          )}
          {config.on_failed_goto && (
            <span>On fail: {allStatuses.find(s => s.id === config.on_failed_goto)?.name}</span>
          )}
          {config.ask_approve_to_continue && (
            <span style={{ color: '#eab308' }}>Requires approval</span>
          )}
        </div>

        {/* Expand Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 transition-colors"
          style={{ color: `rgb(var(--text-tertiary))` }}
          disabled={disabled}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = `rgb(var(--text-primary))`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = `rgb(var(--text-tertiary))`
          }}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Remove Button */}
        <button
          type="button"
          onClick={() => onConfigChange({ ...config, is_included: false })}
          className="p-1 transition-colors"
          style={{ color: '#ef4444' }}
          disabled={disabled}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f87171'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#ef4444'
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Expanded Options */}
      {isExpanded && (
        <div 
          className="mt-3 pt-3 space-y-3"
          style={{ borderTop: '1px solid rgb(var(--border-color))' }}
        >
          {/* Agent Selection */}
          <div className="flex items-center gap-3">
            <label className="w-32 text-sm" style={{ color: `rgb(var(--text-secondary))` }}>Agent:</label>
            <select
              value={config.agent_id || status.default_agent_id || ''}
              onChange={(e) => onConfigChange({ ...config, agent_id: e.target.value || null })}
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm appearance-none pr-10"
              style={{
                backgroundColor: `rgb(var(--bg-primary))`,
                borderColor: `rgb(var(--border-color))`,
                color: `rgb(var(--text-primary))`,
              }}
              disabled={disabled}
            >
              <option value="">Default ({status.default_agent_id || 'None'})</option>
              {availableAgents?.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          {/* On Failed Goto */}
          <div className="flex items-center gap-3">
            <label className="w-32 text-sm" style={{ color: `rgb(var(--text-secondary))` }}>On fail goto:</label>
            <select
              value={config.on_failed_goto || status.default_on_failed_goto || ''}
              onChange={(e) => onConfigChange({ ...config, on_failed_goto: e.target.value || null })}
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm appearance-none pr-10"
              style={{
                backgroundColor: `rgb(var(--bg-primary))`,
                borderColor: `rgb(var(--border-color))`,
                color: `rgb(var(--text-primary))`,
              }}
              disabled={disabled}
            >
              <option value="">Default ({status.default_on_failed_goto ? allStatuses.find(s => s.id === status.default_on_failed_goto)?.name : 'None'})</option>
              {allStatuses
                .filter(s => s.id !== status.id)
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          </div>

          {/* Ask Approve to Continue */}
          <div className="flex items-center gap-3">
            <label className="w-32 text-sm" style={{ color: `rgb(var(--text-secondary))` }}>Ask to approve:</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.ask_approve_to_continue ?? status.default_ask_approve_to_continue ?? false}
                onChange={(e) => onConfigChange({ ...config, ask_approve_to_continue: e.target.checked })}
                className="w-4 h-4 rounded border transition-colors focus:outline-none focus:ring-2"
                style={{
                  borderColor: `rgb(var(--border-color))`,
                  accentColor: `rgb(var(--accent-primary, 59 130 246))`,
                }}
                disabled={disabled}
              />
              <span className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
                {status.default_ask_approve_to_continue ? '(Default: Yes)' : '(Default: No)'}
              </span>
            </label>
          </div>

          {/* Instructions Override */}
          <div className="flex flex-col gap-2">
            <label className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>Override instructions (markdown):</label>
            <textarea
              value={config.instructions_override || ''}
              onChange={(e) => onConfigChange({ ...config, instructions_override: e.target.value })}
              placeholder="Custom instructions for this status in this ticket..."
              className="w-full rounded-lg border px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2"
              style={{
                backgroundColor: `rgb(var(--bg-primary))`,
                borderColor: `rgb(var(--border-color))`,
                color: `rgb(var(--text-primary))`,
                '--tw-ring-color': `rgb(var(--accent-primary, 59 130 246))`,
              } as React.CSSProperties}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function StatusFlowBuilder({
  statuses,
  initialConfigs = [],
  availableAgents = [],
  onChange,
  disabled = false,
}: StatusFlowBuilderProps) {
  const buildItemsFromConfigs = (configs: FlowConfig[]) => {
    logger.debug('[StatusFlowBuilder] buildItemsFromConfigs input', {
      statusesCount: statuses.length,
      configsCount: configs.length,
      configStatusIds: configs.map(c => c.status_id),
      statusesIds: statuses.map(s => s.id),
    })

    const includedStatuses = statuses.filter(s =>
      configs.some(c => c.status_id === s.id && c.is_included !== false)
    )

    logger.debug('[StatusFlowBuilder] matched statuses for configs', {
      matchedCount: includedStatuses.length,
      matchedStatusIds: includedStatuses.map(s => s.id),
    })

    return includedStatuses.map((status, index) => {
      const existingConfig = configs.find(c => c.status_id === status.id)

      return {
        status,
        config: existingConfig
          ? { ...existingConfig, flow_order: existingConfig.flow_order ?? index }
          : {
              status_id: status.id,
              flow_order: index,
              is_included: true,
            },
      }
    })
  }

  const [items, setItems] = useState<StatusFlowConfigItem[]>(() => {
    return buildItemsFromConfigs(initialConfigs)
  })

  useEffect(() => {
    const nextItems = buildItemsFromConfigs(initialConfigs)
    logger.debug('[StatusFlowBuilder] syncing local items from props', {
      nextItemsCount: nextItems.length,
      nextItemStatusIds: nextItems.map(item => item.status.id),
    })
    setItems(nextItems)
  }, [statuses, initialConfigs])

  useEffect(() => {
    logger.debug('[StatusFlowBuilder] items state changed', {
      itemsCount: items.length,
      itemStatusIds: items.map(item => item.status.id),
    })
  }, [items])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.status.id === active.id)
        const newIndex = items.findIndex((item) => item.status.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)
        // Update flow_order and notify parent
        const newConfigs = newItems.map((item, index) => ({
          ...item.config,
          flow_order: index,
        }))
        onChange(newConfigs)
        return newItems
      })
    }
  }

  function handleConfigChange(statusId: string, newConfig: FlowConfig) {
    setItems((items) =>
      items.map((item) =>
        item.status.id === statusId
          ? { ...item, config: { ...item.config, ...newConfig } }
          : item
      )
    )
    // Notify parent with all configs
    const newConfigs = items.map(item => ({
      ...item.config,
      ...(item.status.id === statusId ? newConfig : {}),
    }))
    onChange(newConfigs)
  }

  function handleAddStatus(statusId: string) {
    const status = statuses.find(s => s.id === statusId)
    if (!status) return

    const newConfig: FlowConfig = {
      status_id: statusId,
      flow_order: items.length,
      is_included: true,
    }

    const newItems = [...items, { status, config: newConfig }]
    setItems(newItems)
    onChange([...items.map(i => i.config), newConfig])
  }

  const availableStatuses = statuses.filter(
    s => !items.some(item => item.status.id === s.id)
  )

  return (
    <div className="space-y-4">
      {/* Draggable List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(item => item.status.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableItem
              key={item.status.id}
              id={item.status.id}
              status={item.status}
              config={item.config}
              onConfigChange={(config) => handleConfigChange(item.status.id, config)}
              availableAgents={availableAgents}
              allStatuses={statuses}
              disabled={disabled}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add Status Dropdown */}
      {availableStatuses.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value=""
            onChange={(e) => {
              e.preventDefault()
              if (e.target.value) {
                handleAddStatus(e.target.value)
                e.target.value = ''
              }
            }}
            className="flex-1 rounded-lg border px-3 py-2 text-sm appearance-none pr-10"
            style={{
              backgroundColor: `rgb(var(--bg-primary))`,
              borderColor: `rgb(var(--border-color))`,
              color: `rgb(var(--text-primary))`,
            }}
            disabled={disabled}
          >
            <option value="">+ Add status to flow...</option>
            {availableStatuses.map(status => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </select>
        </div>
      )}

      {items.length === 0 && (
        <div 
          className="text-center py-8 border-2 border-dashed rounded-lg"
          style={{ 
            color: `rgb(var(--text-tertiary))`,
            borderColor: `rgb(var(--border-color))`
          }}
        >
          <p>No statuses in flow yet.</p>
          <p className="text-sm mt-1">Add statuses from the dropdown above.</p>
        </div>
      )}
    </div>
  )
}
