/**
 * React hooks for consuming GatewayService
 *
 * Provides a reactive interface to the GatewayService singleton with
 * automatic re-renders on state changes.
 */

'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  getGatewayService,
  type GatewayServiceState,
  type GatewayServiceClass,
} from '../services/gateway-service'
import type { AgentInfo, Gateway } from '../db/schema'
import type { GatewayServiceEvents } from '../services/gateway-service'
import logger from '@/lib/logger/index.js'


// ============================================================================
// useGatewayService - Get full service state
// ============================================================================

/**
 * Subscribe to the full GatewayService state
 * Automatically re-renders when any state changes
 */
export function useGatewayService(): GatewayServiceState {
  const [state, setState] = useState<GatewayServiceState>(() =>
    getGatewayService().getState()
  )

  useEffect(() => {
    const service = getGatewayService()

    // Initialize service if not already initialized
    if (!service.getState().isInitialized) {
      service.initialize().catch((error) => {
        logger.error('[useGatewayService] Failed to initialize:', error)
      })
    }

    const unsubscribe = service.subscribe(setState)
    return unsubscribe
  }, [])

  return state
}

// ============================================================================
// useGatewayServiceValue - Select specific state slice
// ============================================================================

/**
 * Subscribe to a specific slice of GatewayService state
 * Only re-renders when the selected value changes
 *
 * @example
 * const agents = useGatewayServiceValue(state => state.agents)
 * const isConnected = useGatewayServiceValue(state => state.isConnected)
 */
export function useGatewayServiceValue<T>(
  selector: (state: GatewayServiceState) => T
): T {
  // Store selector in a ref to prevent re-subscribing when selector changes
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  
  const [value, setValue] = useState<T>(() => selector(getGatewayService().getState()))

  useEffect(() => {
    const service = getGatewayService()

    // Initialize service if not already initialized
    if (!service.getState().isInitialized) {
      service.initialize().catch((error) => {
        logger.error('[useGatewayServiceValue] Failed to initialize:', error)
      })
    }

    const unsubscribe = service.subscribe((state) => {
      const newValue = selectorRef.current(state)
      setValue((prev) => {
        // Only update if value actually changed (uses shallow comparison)
        if (prev !== newValue && JSON.stringify(prev) !== JSON.stringify(newValue)) {
          return newValue
        }
        return prev
      })
    })

    return unsubscribe
  }, []) // Empty deps - only subscribe once

  return value
}

// ============================================================================
// useGatewayServiceActions - Get service actions
// ============================================================================

/**
 * Get actions to modify GatewayService state
 * These actions don't trigger re-renders themselves
 */
export interface GatewayServiceActions {
  refreshGateways: () => Promise<Gateway[]>
  connectGateway: (gatewayId: string) => Promise<void>
  disconnectGateway: (gatewayId: string) => Promise<void>
  checkHealth: (gatewayId: string) => Promise<{ healthy: boolean; message?: string }>
  refreshAgents: () => Promise<AgentInfo[]>
  tryReconnect: () => Promise<boolean>
  initialize: () => Promise<void>
}

export function useGatewayServiceActions(): GatewayServiceActions {
  const service = useMemo(() => getGatewayService(), [])

  return useMemo(
    () => ({
      refreshGateways: () => service.refreshGateways(),
      connectGateway: (gatewayId: string) => service.connectGateway(gatewayId),
      disconnectGateway: (gatewayId: string) => service.disconnectGateway(gatewayId),
      checkHealth: (gatewayId: string) => service.checkHealth(gatewayId),
      refreshAgents: () => service.refreshAgents(),
      tryReconnect: () => service.tryReconnect(),
      initialize: () => service.initialize(),
    }),
    [service]
  )
}

// ============================================================================
// useSetGatewayService - Alias for useGatewayServiceActions
// ============================================================================

/**
 * Alias for useGatewayServiceActions - matches the pattern from user's example
 */
export function useSetGatewayService(): GatewayServiceActions {
  return useGatewayServiceActions()
}

// ============================================================================
// useGatewayEvent - Listen to specific gateway events
// ============================================================================

/**
 * Subscribe to a specific GatewayService event
 * 
 * @example
 * useGatewayEvent('gateway:connected', ({ gatewayId }) => {
 *   logger.debug('Gateway connected:', gatewayId)
 * })
 */
export function useGatewayEvent<K extends keyof GatewayServiceEvents>(
  eventType: K,
  callback: (payload: GatewayServiceEvents[K]) => void,
  deps: readonly React.DependencyList = []
): void {
  useEffect(() => {
    const service = getGatewayService()
    const unsubscribe = (service as any).on(eventType, callback)

    return unsubscribe
  }, [eventType, callback, ...deps])
}

// ============================================================================
// Convenience Hooks - Common state selections
// ============================================================================

/**
 * Get the list of available agents
 * Only re-renders when agents list changes
 */
export function useGatewayAgents(): {
  agents: AgentInfo[]
  isLoadingAgents: boolean
  refreshAgents: () => Promise<AgentInfo[]>
} {
  const agents = useGatewayServiceValue((state) => state.agents)
  const isLoadingAgents = useGatewayServiceValue((state) => state.isLoadingAgents)
  const { refreshAgents } = useGatewayServiceActions()

  return useMemo(
    () => ({
      agents,
      isLoadingAgents,
      refreshAgents,
    }),
    [agents, isLoadingAgents, refreshAgents]
  )
}

/**
 * Get gateway connection status
 * Only re-renders when connection state changes
 */
export function useGatewayConnection(): {
  isConnected: boolean
  isLoading: boolean
  isConnecting: boolean
  connectionError: string | null
  activeGatewayId: string | null
  tryReconnect: () => Promise<boolean>
} {
  const isConnected = useGatewayServiceValue((state) => state.isConnected)
  const isLoading = useGatewayServiceValue((state) => state.isLoading)
  const isConnecting = useGatewayServiceValue((state) => state.isConnecting)
  const connectionError = useGatewayServiceValue((state) => state.connectionError)
  const activeGatewayId = useGatewayServiceValue((state) => state.activeGatewayId)
  const { tryReconnect } = useGatewayServiceActions()

  return useMemo(
    () => ({
      isConnected,
      isLoading,
      isConnecting,
      connectionError,
      activeGatewayId,
      tryReconnect,
    }),
    [isConnected, isLoading, isConnecting, connectionError, activeGatewayId, tryReconnect]
  )
}

/**
 * Get list of gateways
 * Only re-renders when gateways list changes
 */
export function useGatewayList(): {
  gateways: Gateway[]
  activeGatewayId: string | null
  refreshGateways: () => Promise<Gateway[]>
  connectGateway: (gatewayId: string) => Promise<void>
  disconnectGateway: (gatewayId: string) => Promise<void>
} {
  const gateways = useGatewayServiceValue((state) => state.gateways)
  const activeGatewayId = useGatewayServiceValue((state) => state.activeGatewayId)
  const { refreshGateways, connectGateway, disconnectGateway } = useGatewayServiceActions()

  return useMemo(
    () => ({
      gateways,
      activeGatewayId,
      refreshGateways,
      connectGateway,
      disconnectGateway,
    }),
    [gateways, activeGatewayId, refreshGateways, connectGateway, disconnectGateway]
  )
}

/**
 * Get the service instance directly
 * Use this for advanced scenarios where you need direct access to the service
 */
export function useGatewayServiceInstance(): GatewayServiceClass {
  return useMemo(() => getGatewayService(), [])
}

// ============================================================================
// Type exports
// ============================================================================

export type { GatewayServiceState, GatewayServiceClass, GatewayServiceEvents }
