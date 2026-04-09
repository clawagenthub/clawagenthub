/**
 * GatewayService - Singleton service for managing gateway connections and state
 * 
 * This service acts as a client proxy through existing API routes, managing
 * gateway state with event emitters and providing auto-reconnection logic.
 */

import { createServiceEventEmitter, type ServiceEventEmitter } from './service-event-emitter'
import type { Gateway, AgentInfo } from '../db/schema'
import logger, { logCategories } from '@/lib/logger/index.js'

// ============================================================================
// Types
// ============================================================================

export interface GatewayServiceState {
  isLoading: boolean
  isConnecting: boolean
  isConnected: boolean
  connectionError: string | null
  gateways: Gateway[]
  activeGatewayId: string | null
  agents: AgentInfo[]
  isLoadingAgents: boolean
  reconnectAttempts: number
  lastReconnectAttempt: number | null
  isInitialized: boolean
}

export interface GatewayServiceEvents {
  'state:change': GatewayServiceState
  'gateway:connecting': { gatewayId: string }
  'gateway:connected': { gatewayId: string; gateway: Gateway }
  'gateway:disconnected': { gatewayId: string }
  'gateway:error': { gatewayId: string; error: string }
  'agents:loading': void
  'agents:loaded': { agents: AgentInfo[] }
  'agents:error': { error: string }
  'reconnect:attempt': { gatewayId: string }
  'reconnect:success': { gatewayId: string }
  'reconnect:failed': { gatewayId: string; error: string }
}

const INITIAL_STATE: GatewayServiceState = {
  isLoading: false,
  isConnecting: false,
  isConnected: false,
  connectionError: null,
  gateways: [],
  activeGatewayId: null,
  agents: [],
  isLoadingAgents: false,
  reconnectAttempts: 0,
  lastReconnectAttempt: null,
  isInitialized: false,
}

// ============================================================================
// GatewayService Class
// ============================================================================

class GatewayServiceClass {
  private stateEmitter: ServiceEventEmitter<GatewayServiceState>
  private eventListeners: Map<keyof GatewayServiceEvents, Set<(...args: any[]) => void>> =
    new Map()
  private abortController: AbortController | null = null

  constructor() {
    this.stateEmitter = createServiceEventEmitter(INITIAL_STATE, {
      debug: process.env.NODE_ENV === 'development',
      name: 'GatewayService',
    })
  }

  getState(): GatewayServiceState {
    return this.stateEmitter.get()
  }

  subscribe(listener: (state: GatewayServiceState) => void): () => void {
    return this.stateEmitter.subscribe(listener)
  }

  getStateEmitter(): ServiceEventEmitter<GatewayServiceState> {
    return this.stateEmitter
  }

  private setState(updater: Partial<GatewayServiceState> | ((prev: GatewayServiceState) => Partial<GatewayServiceState>)): void {
    const prevState = this.stateEmitter.get()
    let updates: Partial<GatewayServiceState>

    if (typeof updater === 'function') {
      updates = (updater as (prev: GatewayServiceState) => Partial<GatewayServiceState>)(prevState)
    } else {
      updates = updater
    }

    const newState = { ...prevState, ...updates }
    this.stateEmitter.emit(newState)
    this.emit('state:change', newState)
  }

  on<K extends keyof GatewayServiceEvents>(
    event: K,
    callback: (payload: GatewayServiceEvents[K]) => void
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
    return () => {
      this.eventListeners.get(event)?.delete(callback)
    }
  }

  private emit<K extends keyof GatewayServiceEvents>(
    event: K,
    payload: GatewayServiceEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(payload)
        } catch (error) {
          logger.error({ category: logCategories.GATEWAY_SERVICE }, 'Error in %s listener: %s', String(event), String(error))
        }
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.getState().isInitialized) {
      logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Already initialized')
      return
    }

    logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Initializing...')
    this.setState({ isLoading: true })

    try {
      await this.refreshGateways()
      this.setState({ isInitialized: true, isLoading: false })
      logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Initialized successfully')
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_SERVICE }, 'Initialization failed: %s', String(error))
      this.setState({
        isLoading: false,
        connectionError: error instanceof Error ? error.message : 'Failed to initialize',
      })
      throw error
    }
  }

  async refreshGateways(): Promise<Gateway[]> {
    logger.debug({ category: logCategories.GATEWAY_SERVICE }, 'Fetching gateways...')
    this.setState({ isLoading: true })

    try {
      const response = await fetch('/api/gateways', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch gateways')
      }

      const data = await response.json()
      const gateways = data.gateways || []

      const connectedGateways = gateways.filter((g: Gateway) => g.status === 'connected')
      const activeGatewayId = connectedGateways.length > 0 ? connectedGateways[0].id : null

      this.setState({
        gateways,
        activeGatewayId,
        isConnected: connectedGateways.length > 0,
        connectionError: null,
        isLoading: false,
      })

      logger.debug({ category: logCategories.GATEWAY_SERVICE }, 'Gateways fetched: %s total, %s connected', gateways.length, connectedGateways.length)

      if (connectedGateways.length > 0) {
        await this.refreshAgents()
      }

      return gateways
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_SERVICE }, 'Failed to fetch gateways: %s', String(error))
      this.setState({
        isLoading: false,
        connectionError: error instanceof Error ? error.message : 'Failed to fetch gateways',
        isConnected: false,
      })
      throw error
    }
  }

  async connectGateway(gatewayId: string): Promise<void> {
    const state = this.getState()

    if (state.isConnecting) {
      logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Already connecting, skipping')
      return
    }

    logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Connecting to gateway %s', gatewayId)
    this.setState({ isConnecting: true, connectionError: null })
    this.emit('gateway:connecting', { gatewayId })

    try {
      const response = await fetch(`/api/gateways/${gatewayId}/connect`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to connect to gateway')
      }

      const data = await response.json()
      const gateway = data.gateway

      await this.refreshGateways()

      this.setState({
        isConnecting: false,
        isConnected: true,
        activeGatewayId: gatewayId,
        connectionError: null,
      })

      this.emit('gateway:connected', { gatewayId, gateway })
      logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Connected to gateway %s', gatewayId)

      await this.refreshAgents()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect'
      logger.error({ category: logCategories.GATEWAY_SERVICE }, 'Connection failed: %s', errorMessage)

      this.setState({
        isConnecting: false,
        isConnected: false,
        connectionError: errorMessage,
      })

      this.emit('gateway:error', { gatewayId, error: errorMessage })
      throw error
    }
  }

  async disconnectGateway(gatewayId: string): Promise<void> {
    logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Disconnecting gateway %s', gatewayId)

    try {
      const response = await fetch(`/api/gateways/${gatewayId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        logger.warn({ category: logCategories.GATEWAY_SERVICE }, 'Failed to disconnect gateway %s', gatewayId)
      }

      await this.refreshGateways()

      this.emit('gateway:disconnected', { gatewayId })
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_SERVICE }, 'Disconnect error: %s', String(error))
      await this.refreshGateways()
    }
  }

  async checkHealth(gatewayId: string): Promise<{ healthy: boolean; message?: string }> {
    logger.debug({ category: logCategories.GATEWAY_SERVICE }, 'Checking health for gateway %s', gatewayId)

    try {
      const response = await fetch(`/api/gateways/${gatewayId}/health`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Health check request failed')
      }

      const data = await response.json()

      if (!data.healthy) {
        this.setState({
          isConnected: false,
          connectionError: data.message || 'Gateway unhealthy',
        })
        this.emit('gateway:error', {
          gatewayId,
          error: data.message || 'Gateway unhealthy',
        })
      }

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Health check failed'
      logger.error({ category: logCategories.GATEWAY_SERVICE }, 'Health check failed: %s', errorMessage)

      this.setState({
        isConnected: false,
        connectionError: errorMessage,
      })

      return { healthy: false, message: errorMessage }
    }
  }

  async tryReconnect(): Promise<boolean> {
    const state = this.getState()

    if (state.isConnecting) {
      logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Already connecting, skipping reconnect')
      return false
    }

    if (state.reconnectAttempts >= 1) {
      logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Max reconnect attempts reached')
      return false
    }

    const gatewayId = state.activeGatewayId || (state.gateways.length > 0 ? state.gateways[0].id : null)
    if (!gatewayId) {
      logger.info({ category: logCategories.GATEWAY_SERVICE }, 'No gateway to reconnect to')
      return false
    }

    logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Attempting reconnection to %s', gatewayId)
    this.emit('reconnect:attempt', { gatewayId })

    this.setState({
      reconnectAttempts: state.reconnectAttempts + 1,
      lastReconnectAttempt: Date.now(),
    })

    try {
      await this.connectGateway(gatewayId)
      this.emit('reconnect:success', { gatewayId })
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Reconnection failed'
      logger.error({ category: logCategories.GATEWAY_SERVICE }, 'Reconnection failed: %s', errorMessage)
      this.emit('reconnect:failed', { gatewayId, error: errorMessage })
      return false
    }
  }

  private resetReconnectAttempts(): void {
    this.setState({
      reconnectAttempts: 0,
      lastReconnectAttempt: null,
    })
  }

  async refreshAgents(): Promise<AgentInfo[]> {
    const state = this.getState()

    logger.debug({ category: logCategories.GATEWAY_SERVICE }, 'Fetching agents...')
    this.setState({ isLoadingAgents: true })
    this.emit('agents:loading', undefined)

    try {
      const response = await fetch('/api/chat/agents', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch agents')
      }

      const data = await response.json()
      const agents = data.agents || []

      const hasConnectedGatewayInDb = state.gateways.some((g: Gateway) => g.status === 'connected')
      const actuallyConnected = agents.length > 0 || hasConnectedGatewayInDb

      this.setState({
        agents,
        isLoadingAgents: false,
        isConnected: actuallyConnected,
      })

      this.emit('agents:loaded', { agents })
      logger.debug({ category: logCategories.GATEWAY_SERVICE }, 'Agents fetched: %s', agents.length)

      return agents
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_SERVICE }, 'Failed to fetch agents: %s', String(error))
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch agents'

      const hasConnectedGatewayInDb = state.gateways.some((g: Gateway) => g.status === 'connected')
      
      this.setState({
        isLoadingAgents: false,
        isConnected: hasConnectedGatewayInDb,
        connectionError: hasConnectedGatewayInDb ? null : errorMessage,
      })

      this.emit('agents:error', { error: errorMessage })
      throw error
    }
  }

  cleanup(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    this.eventListeners.clear()
    this.stateEmitter.emit(INITIAL_STATE)

    logger.info({ category: logCategories.GATEWAY_SERVICE }, 'Cleaned up')
  }
}

let gatewayServiceInstance: GatewayServiceClass | null = null

export function getGatewayService(): GatewayServiceClass {
  if (!gatewayServiceInstance) {
    gatewayServiceInstance = new GatewayServiceClass()
  }
  return gatewayServiceInstance
}

export function resetGatewayService(): void {
  if (gatewayServiceInstance) {
    gatewayServiceInstance.cleanup()
    gatewayServiceInstance = null
  }
}

export type { GatewayServiceClass }
export { GatewayServiceClass as GatewayService }
