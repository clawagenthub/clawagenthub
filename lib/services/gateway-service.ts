/**
 * GatewayService - Singleton service for managing gateway connections and state
 * 
 * This service acts as a client proxy through existing API routes, managing
 * gateway state with event emitters and providing auto-reconnection logic.
 */

import { createServiceEventEmitter, type ServiceEventEmitter } from './service-event-emitter'
import type { Gateway, AgentInfo } from '../db/schema'

// ============================================================================
// Types
// ============================================================================

export interface GatewayServiceState {
  // Loading states
  isLoading: boolean
  isConnecting: boolean
  
  // Connection status
  isConnected: boolean
  connectionError: string | null
  
  // Gateway data
  gateways: Gateway[]
  activeGatewayId: string | null
  
  // Agents data
  agents: AgentInfo[]
  isLoadingAgents: boolean
  
  // Reconnection state
  reconnectAttempts: number
  lastReconnectAttempt: number | null
  
  // Initialization state
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

  // ========================================================================
  // State Management
  // ========================================================================

  /**
   * Get the current service state
   */
  getState(): GatewayServiceState {
    return this.stateEmitter.get()
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: GatewayServiceState) => void): () => void {
    return this.stateEmitter.subscribe(listener)
  }

  /**
   * Get the state emitter (for advanced use cases)
   */
  getStateEmitter(): ServiceEventEmitter<GatewayServiceState> {
    return this.stateEmitter
  }

  /**
   * Update internal state and emit changes
   */
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

  // ========================================================================
  // Event System
  // ========================================================================

  /**
   * Listen to a specific gateway event
   */
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

  /**
   * Emit an event to all listeners
   */
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
          console.error(`[GatewayService] Error in ${event} listener:`, error)
        }
      }
    }
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize the service and fetch gateways
   */
  async initialize(): Promise<void> {
    if (this.getState().isInitialized) {
      console.log('[GatewayService] Already initialized')
      return
    }

    console.log('[GatewayService] Initializing...')
    this.setState({ isLoading: true })

    try {
      await this.refreshGateways()
      this.setState({ isInitialized: true, isLoading: false })
      console.log('[GatewayService] Initialized successfully')
    } catch (error) {
      console.error('[GatewayService] Initialization failed:', error)
      this.setState({
        isLoading: false,
        connectionError: error instanceof Error ? error.message : 'Failed to initialize',
      })
      throw error
    }
  }

  // ========================================================================
  // Gateway Management
  // ========================================================================

  /**
   * Refresh gateways from the API
   */
  async refreshGateways(): Promise<Gateway[]> {
    console.log('[GatewayService] Fetching gateways...')
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

      // Determine if we have any connected gateways in the database
      // The actual connection will be verified by refreshAgents()
      const connectedGateways = gateways.filter((g: Gateway) => g.status === 'connected')
      const activeGatewayId = connectedGateways.length > 0 ? connectedGateways[0].id : null

      this.setState({
        gateways,
        activeGatewayId,
        isConnected: connectedGateways.length > 0,
        connectionError: null,
        isLoading: false,
      })

      console.log('[GatewayService] Gateways fetched:', {
        total: gateways.length,
        connected: connectedGateways.length,
        activeGatewayId,
      })

      // After refreshing gateways, refresh agents to verify actual connections
      if (connectedGateways.length > 0) {
        await this.refreshAgents()
      }

      return gateways
    } catch (error) {
      console.error('[GatewayService] Failed to fetch gateways:', error)
      this.setState({
        isLoading: false,
        connectionError: error instanceof Error ? error.message : 'Failed to fetch gateways',
        isConnected: false,
      })
      throw error
    }
  }

  /**
   * Connect to a specific gateway
   */
  async connectGateway(gatewayId: string): Promise<void> {
    const state = this.getState()

    if (state.isConnecting) {
      console.log('[GatewayService] Already connecting, skipping')
      return
    }

    console.log('[GatewayService] Connecting to gateway:', gatewayId)
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

      // Refresh gateways to get updated state
      await this.refreshGateways()

      this.setState({
        isConnecting: false,
        isConnected: true,
        activeGatewayId: gatewayId,
        connectionError: null,
      })

      this.emit('gateway:connected', { gatewayId, gateway })
      console.log('[GatewayService] Connected to gateway:', gatewayId)

      // Load agents after successful connection
      await this.refreshAgents()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect'
      console.error('[GatewayService] Connection failed:', error)

      this.setState({
        isConnecting: false,
        isConnected: false,
        connectionError: errorMessage,
      })

      this.emit('gateway:error', { gatewayId, error: errorMessage })
      throw error
    }
  }

  /**
   * Disconnect from a gateway
   */
  async disconnectGateway(gatewayId: string): Promise<void> {
    console.log('[GatewayService] Disconnecting gateway:', gatewayId)

    try {
      const response = await fetch(`/api/gateways/${gatewayId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        console.warn('[GatewayService] Failed to disconnect gateway:', gatewayId)
      }

      await this.refreshGateways()

      this.emit('gateway:disconnected', { gatewayId })
    } catch (error) {
      console.error('[GatewayService] Disconnect error:', error)
      // Still refresh gateways to get current state
      await this.refreshGateways()
    }
  }

  // ========================================================================
  // Health Check
  // ========================================================================

  /**
   * Check health of a specific gateway
   */
  async checkHealth(gatewayId: string): Promise<{ healthy: boolean; message?: string }> {
    console.log('[GatewayService] Checking health for gateway:', gatewayId)

    try {
      const response = await fetch(`/api/gateways/${gatewayId}/health`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Health check request failed')
      }

      const data = await response.json()

      // Update connection state based on health
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
      console.error('[GatewayService] Health check failed:', error)

      this.setState({
        isConnected: false,
        connectionError: errorMessage,
      })

      return { healthy: false, message: errorMessage }
    }
  }

  // ========================================================================
  // Reconnection Logic
  // ========================================================================

  /**
   * Attempt to reconnect to the active gateway
   * Only attempts once when gateway is not loading
   */
  async tryReconnect(): Promise<boolean> {
    const state = this.getState()

    // Don't reconnect if already connecting
    if (state.isConnecting) {
      console.log('[GatewayService] Already connecting, skipping reconnect')
      return false
    }

    // Don't reconnect if we've already tried once
    if (state.reconnectAttempts >= 1) {
      console.log('[GatewayService] Max reconnect attempts reached')
      return false
    }

    // Need a gateway to reconnect to
    const gatewayId = state.activeGatewayId || (state.gateways.length > 0 ? state.gateways[0].id : null)
    if (!gatewayId) {
      console.log('[GatewayService] No gateway to reconnect to')
      return false
    }

    console.log('[GatewayService] Attempting reconnection to:', gatewayId)
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
      console.error('[GatewayService] Reconnection failed:', error)
      this.emit('reconnect:failed', { gatewayId, error: errorMessage })
      return false
    }
  }

  /**
   * Reset reconnection attempts (call after successful connection)
   */
  private resetReconnectAttempts(): void {
    this.setState({
      reconnectAttempts: 0,
      lastReconnectAttempt: null,
    })
  }

  // ========================================================================
  // Agents Management
  // ========================================================================

  /**
   * Refresh agents from connected gateways
   */
  async refreshAgents(): Promise<AgentInfo[]> {
    const state = this.getState()

    // Always try to fetch agents - the server will check actual connections
    console.log('[GatewayService] Fetching agents...')
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

      // Update connection state based on agents availability
      // If we have agents, gateway is truly connected. If not but DB says connected,
      // it means gateway is connected but has no agents configured.
      const hasConnectedGatewayInDb = state.gateways.some((g: Gateway) => g.status === 'connected')
      const actuallyConnected = agents.length > 0 || hasConnectedGatewayInDb

      this.setState({
        agents,
        isLoadingAgents: false,
        isConnected: actuallyConnected,
      })

      this.emit('agents:loaded', { agents })
      console.log('[GatewayService] Agents fetched:', {
        count: agents.length,
        hasConnectedGatewayInDb,
        actuallyConnected,
      })

      return agents
    } catch (error) {
      console.error('[GatewayService] Failed to fetch agents:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch agents'

      // Don't set isConnected to false on error - there might still be a connected gateway
      const hasConnectedGatewayInDb = state.gateways.some((g: Gateway) => g.status === 'connected')
      
      this.setState({
        isLoadingAgents: false,
        isConnected: hasConnectedGatewayInDb, // Keep connected if gateway exists in DB
        connectionError: hasConnectedGatewayInDb ? null : errorMessage,
      })

      this.emit('agents:error', { error: errorMessage })
      throw error
    }
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  /**
   * Cleanup and reset the service
   */
  cleanup(): void {
    // Cancel any pending requests
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    // Clear all event listeners
    this.eventListeners.clear()

    // Reset state to initial
    this.stateEmitter.emit(INITIAL_STATE)

    console.log('[GatewayService] Cleaned up')
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let gatewayServiceInstance: GatewayServiceClass | null = null

/**
 * Get the singleton GatewayService instance
 */
export function getGatewayService(): GatewayServiceClass {
  if (!gatewayServiceInstance) {
    gatewayServiceInstance = new GatewayServiceClass()
  }
  return gatewayServiceInstance
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetGatewayService(): void {
  if (gatewayServiceInstance) {
    gatewayServiceInstance.cleanup()
    gatewayServiceInstance = null
  }
}

// Export the class type for type checking
export type { GatewayServiceClass }
// Export the class as GatewayService
export { GatewayServiceClass as GatewayService }
