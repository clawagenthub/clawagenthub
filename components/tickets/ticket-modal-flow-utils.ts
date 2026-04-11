import React, { useCallback } from 'react'
import logger, { logCategories as _logCategories } from '@/lib/logger/index.js'

export interface FlowConfig {
  status_id: string
  flow_order: number
  agent_id?: string | null
  on_failed_goto?: string | null
  ask_approve_to_continue?: boolean
  instructions_override?: string
  is_included?: boolean
}

export interface FlowRuntimeStatus {
  flowing_status: 'flowing' | 'stopped' | null
}

export interface StatusInfo {
  id: string
  name: string
  is_flow_included?: boolean
  agent_id?: string | null
  on_failed_goto?: string | null
  ask_approve_to_continue?: boolean
  instructions_override?: string | null
}

// Builds default flow configs from status definitions
export function buildDefaultFlowConfigs(
  statuses: StatusInfo[] | undefined
): FlowConfig[] {
  if (!statuses || statuses.length === 0) {
    return []
  }

  const includedStatuses = statuses.filter((s) => s.is_flow_included)

  return includedStatuses.map((status, index) => ({
    status_id: status.id,
    flow_order: index,
    is_included: true,
    agent_id: status.agent_id ?? undefined,
    on_failed_goto: status.on_failed_goto ?? undefined,
    ask_approve_to_continue: status.ask_approve_to_continue,
    instructions_override: status.instructions_override ?? undefined,
  }))
}

// Maps external flow config format to internal FlowConfig
export function mapExternalFlowConfig(
  config: {
    status?: { id?: string; name?: string }
    status_id?: string
    flow_order: number
    agent_id?: string | null
    on_failed_goto?: string | null
    ask_approve_to_continue?: boolean
    instructions_override?: string | null
    is_included?: boolean
  },
  statusIdByName: Map<string, string>
): FlowConfig | null {
  const fromId = config.status?.id ?? config.status_id
  const fromName = config.status?.name
  const resolvedStatusId =
    fromId || (fromName ? statusIdByName.get(fromName) : undefined)

  if (!resolvedStatusId) {
    return null
  }

  return {
    status_id: resolvedStatusId,
    flow_order: config.flow_order,
    agent_id: config.agent_id ?? undefined,
    on_failed_goto: config.on_failed_goto ?? undefined,
    ask_approve_to_continue: config.ask_approve_to_continue,
    instructions_override: config.instructions_override ?? undefined,
    is_included: config.is_included,
  }
}

// Checks if gateway/auth error based on message
export function isGatewayAuthError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error)
  return (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('503') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('auth') ||
    errorMessage.includes('Gateway') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('unreachable') ||
    errorMessage.includes('not reachable')
  )
}

// Gateway auth error alert message
export function getGatewayAuthErrorMessage(error: unknown): string {
  return `Gateway connection error: ${error instanceof Error ? error.message : String(error)}\n\nThe gateway may need to be restarted. Please go to Settings > Gateways and reconnect.`
}

// Hook return type for flow configuration
export interface UseFlowConfigReturn {
  flowConfigs: FlowConfig[]
  setFlowConfigs: React.Dispatch<React.SetStateAction<FlowConfig[]>>
  handleLoadDefaultConfig: (
    buildDefaultFlowConfigs: () => FlowConfig[],
    statuses: StatusInfo[] | undefined,
    currentStatusId: string,
    onSetStatusId: (id: string) => void
  ) => void
  handleFlowConfigsChange: (configs: FlowConfig[]) => void
}

// Hook for managing flow configuration state and handlers
export function useFlowConfigUtils() {
  const handleFlowConfigsChange = useCallback((configs: FlowConfig[]) => {
    logger.debug('[TicketModal] onChange from StatusFlowBuilder', {
      nextCount: configs.length,
      statusIds: configs.map((config) => config.status_id),
    })
    // Flow configs state is managed in parent component
    // This function is provided for logging/instrumentation if needed
  }, [])

  const handleLoadDefaultConfig = useCallback(
    (
      buildDefaultFlowConfigs: () => FlowConfig[],
      statuses: StatusInfo[] | undefined,
      currentStatusId: string,
      onSetStatusId: (id: string) => void
    ) => {
      const initialConfigs = buildDefaultFlowConfigs()

      logger.debug(
        '[TicketModal] Loading flow configs from status defaults by user action',
        {
          includedCount: initialConfigs.length,
          totalStatuses: statuses?.length ?? 0,
          source: 'manual-load-default-config',
        }
      )

      logger.debug(
        '[TicketModal] Applied default flow configs to modal state',
        {
          appliedCount: initialConfigs.length,
          statusIds: initialConfigs.map((config) => config.status_id),
        }
      )

      if (!currentStatusId && statuses && statuses.length > 0) {
        onSetStatusId(statuses[0].id)
      }

      return initialConfigs
    },
    []
  )

  return {
    handleFlowConfigsChange,
    handleLoadDefaultConfig,
  }
}

// Validate flow config has required fields
export function isValidFlowConfig(config: FlowConfig): boolean {
  return !!config.status_id && config.flow_order >= 0
}

// Get flow config summary for logging
export function getFlowConfigSummary(configs: FlowConfig[]): {
  count: number
  statusIds: string[]
  hasAgents: boolean
  hasFailureHandlers: boolean
} {
  return {
    count: configs.length,
    statusIds: configs.map((config) => config.status_id),
    hasAgents: configs.some((config) => !!config.agent_id),
    hasFailureHandlers: configs.some((config) => !!config.on_failed_goto),
  }
}
