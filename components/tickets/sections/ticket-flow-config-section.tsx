'use client'

import React from 'react'
import { Select } from '@/components/ui/select'
import { StatusFlowBuilder } from '../status-flow-builder'
import type { TicketFlowMode } from '@/lib/db/schema'
import type { FlowConfig } from '../ticket-modal-flow-utils'

interface TicketFlowConfigSectionProps {
  flowEnabled: boolean
  flowMode: TicketFlowMode
  onFlowModeChange: (value: TicketFlowMode) => void
  statuses:
    | Array<{
        id: string
        name: string
        color: string
        default_agent_id?: string | null
        default_on_failed_goto?: string | null
        default_ask_approve_to_continue?: boolean
      }>
    | undefined
  flowConfigs: FlowConfig[]
  availableAgents?: Array<{ id: string; name: string }>
  canLoadDefaultConfig: boolean
  onLoadDefaultClick: () => void
  onFlowConfigsChange: (configs: FlowConfig[]) => void
  disabled: boolean
  flowModeOptions: Array<{ value: string; label: string }>
}

export function TicketFlowConfigSection({
  flowEnabled,
  flowMode,
  onFlowModeChange,
  statuses,
  flowConfigs,
  availableAgents,
  canLoadDefaultConfig,
  onLoadDefaultClick,
  onFlowConfigsChange,
  disabled,
  flowModeOptions,
}: TicketFlowConfigSectionProps) {
  if (!flowEnabled || !statuses) return null

  return (
    <div
      className="border-t pt-4"
      style={{ borderColor: `rgb(var(--border-color))` }}
    >
      <Select
        label="Flow Mode"
        options={flowModeOptions}
        value={flowMode}
        onChange={(e) => onFlowModeChange(e.target.value as TicketFlowMode)}
        disabled={disabled}
      />
      <p
        className="mb-3 mt-1 text-xs"
        style={{ color: `rgb(var(--text-secondary))` }}
      >
        Manual mode is recommended by default. Automatic mode advances to next
        status without waiting.
      </p>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h3
          className="text-sm font-medium"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Flow Configuration
        </h3>
        {canLoadDefaultConfig && (
          <button
            type="button"
            onClick={onLoadDefaultClick}
            disabled={disabled}
            className="rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{
              backgroundColor: `rgb(var(--bg-secondary))`,
              color: `rgb(var(--text-primary))`,
              border: '1px solid rgb(var(--border-color))',
            }}
          >
            Load Default Config
          </button>
        )}
      </div>

      <p
        className="mb-3 text-xs"
        style={{ color: `rgb(var(--text-secondary))` }}
      >
        Drag and drop to reorder. Click to expand options. Customize agent,
        failure handling, and approval requirements per status.
      </p>

      <StatusFlowBuilder
        statuses={statuses}
        initialConfigs={flowConfigs}
        availableAgents={availableAgents}
        onChange={onFlowConfigsChange}
        disabled={disabled}
      />
    </div>
  )
}
