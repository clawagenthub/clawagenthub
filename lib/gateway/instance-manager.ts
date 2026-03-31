/**
 * Gateway Session Instance Manager
 *
 * Singleton manager for all gateway session instances.
 * Handles creating, reusing, and cleaning up session instances.
 *
 * Architecture:
 * - One instance per session (identified by sessionId)
 * - Instances persist even when no clients are connected
 * - Instances are cleaned up after idle timeout
 */

import { randomUUID } from 'crypto'
import WebSocket from 'ws'
import { GatewaySessionInstance, type ClientConnection } from './session-instance.js'
import { getDefaultGateway, getGatewayById } from './config.js'
import type { InstanceEvent, InstanceStatus } from './protocol.js'

// ============================================================================
// TYPES
// ============================================================================

/** Instance entry in the manager */
interface InstanceEntry {
  instance: GatewaySessionInstance
  createdAt: Date
  lastUsedAt: Date
}

/** Message from client (subset of InstanceMessage types) */
type ClientManagerMessage =
  | { type: 'chat.send'; content: string; options?: Record<string, unknown> }
  | { type: 'chat.abort'; runId: string }
  | { type: 'ping' }

/** Options for getting or creating an instance */
export interface GetInstanceOptions {
  sessionId: string
  agentId: string
  sessionKey?: string
  gatewayId?: string
  origin?: string
}

/** Manager statistics */
export interface InstanceManagerStats {
  totalInstances: number
  activeInstances: number
  idleInstances: number
  totalClients: number
  instances: InstanceStatus[]
}

// ============================================================================
// INSTANCE MANAGER CLASS
// ============================================================================

class GatewayInstanceManager {
  // Map of sessionId to instance entry
  private instances: Map<string, InstanceEntry> = new Map()

  // Map of clientId to sessionId (for quick client lookup)
  private clientToSession: Map<string, string> = new Map()

  // Event callbacks
  private eventCallbacks: Set<(event: InstanceEvent) => void> = new Set()

  // Cleanup interval
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Start cleanup interval
    this.startCleanupInterval()
  }

  // ========================================================================
  // INSTANCE MANAGEMENT
  // ========================================================================

  /**
   * Get or create a session instance
   */
  async getOrCreateInstance(options: GetInstanceOptions): Promise<GatewaySessionInstance> {
    const { sessionId, agentId, sessionKey, gatewayId, origin } = options

    // Check if instance already exists
    const existing = this.instances.get(sessionId)
    if (existing) {
      existing.lastUsedAt = new Date()
      console.log('[InstanceManager] Reusing existing instance', {
        sessionId,
        agentId
      })
      return existing.instance
    }

    // Get gateway configuration
    const gateway = gatewayId
      ? getGatewayById(gatewayId)
      : getDefaultGateway()

    if (!gateway) {
      throw new Error('No gateway available. Please add and connect a gateway in settings.')
    }

    console.log('[InstanceManager] Creating new instance', {
      sessionId,
      agentId,
      sessionKey,
      gatewayId: gateway.id,
      gatewayName: gateway.name
    })

    // Create new instance
    const instance = new GatewaySessionInstance({
      sessionId,
      agentId,
      sessionKey,
      gateway,
      origin
    })

    // Set up event forwarding
    instance.onEvent((event) => this.notifyEventCallbacks(event))

    // Start the instance
    await instance.start()

    // Store instance
    const entry: InstanceEntry = {
      instance,
      createdAt: new Date(),
      lastUsedAt: new Date()
    }
    this.instances.set(sessionId, entry)

    return instance
  }

  /**
   * Get an existing instance by session ID
   */
  getInstance(sessionId: string): GatewaySessionInstance | null {
    const entry = this.instances.get(sessionId)
    return entry?.instance ?? null
  }

  /**
   * Check if an instance exists for a session
   */
  hasInstance(sessionId: string): boolean {
    return this.instances.has(sessionId)
  }

  /**
   * Remove and stop an instance
   */
  async removeInstance(sessionId: string): Promise<void> {
    const entry = this.instances.get(sessionId)
    if (!entry) return

    console.log('[InstanceManager] Removing instance', { sessionId })

    // Stop the instance
    entry.instance.stop()

    // Remove from map
    this.instances.delete(sessionId)

    // Clean up any orphaned client mappings
    for (const [clientId, sid] of this.clientToSession.entries()) {
      if (sid === sessionId) {
        this.clientToSession.delete(clientId)
      }
    }
  }

  /**
   * Get all instances
   */
  getAllInstances(): Map<string, InstanceEntry> {
    return this.instances
  }

  // ========================================================================
  // CLIENT MANAGEMENT
  // ========================================================================

  /**
   * Add a client to an instance
   */
  async addClient(
    clientId: string,
    ws: any,
    userId: string,
    options: GetInstanceOptions & { sinceSeq?: number }
  ): Promise<void> {
    const instance = await this.getOrCreateInstance(options)

    // Update last used time
    const entry = this.instances.get(options.sessionId)
    if (entry) {
      entry.lastUsedAt = new Date()
    }

    // Map client to session
    this.clientToSession.set(clientId, options.sessionId)

    // Add client to instance
    instance.addClient(clientId, ws, userId, options.sinceSeq)

    console.log('[InstanceManager] Client added', {
      clientId,
      sessionId: options.sessionId,
      agentId: options.agentId
    })
  }

  /**
   * Remove a client from its instance
   */
  removeClient(clientId: string): void {
    const sessionId = this.clientToSession.get(clientId)
    if (!sessionId) return

    const instance = this.getInstance(sessionId)
    if (instance) {
      instance.removeClient(clientId)
    }

    this.clientToSession.delete(clientId)

    console.log('[InstanceManager] Client removed', {
      clientId,
      sessionId
    })
  }

  /**
   * Handle message from a client
   */
  async handleClientMessage(clientId: string, message: ClientManagerMessage): Promise<void> {
    const sessionId = this.clientToSession.get(clientId)
    if (!sessionId) {
      console.warn('[InstanceManager] No session found for client', { clientId })
      return
    }

    const instance = this.getInstance(sessionId)
    if (!instance) {
      console.warn('[InstanceManager] No instance found for session', { sessionId })
      return
    }

    await instance.handleClientMessage(clientId, message)
  }

  /**
   * Get the session ID for a client
   */
  getClientSessionId(clientId: string): string | null {
    return this.clientToSession.get(clientId) ?? null
  }

  // ========================================================================
  // STATISTICS
  // ========================================================================

  /**
   * Get manager statistics
   */
  getStats(): InstanceManagerStats {
    let activeCount = 0
    let idleCount = 0
    let totalClients = 0
    const instanceStatuses: InstanceStatus[] = []

    for (const entry of this.instances.values()) {
      const status = entry.instance.getStatus()
      instanceStatuses.push(status)

      if (status.state === 'connected' || status.state === 'connecting') {
        if (status.clientCount > 0) {
          activeCount++
        } else {
          idleCount++
        }
      }

      totalClients += status.clientCount
    }

    return {
      totalInstances: this.instances.size,
      activeInstances: activeCount,
      idleInstances: idleCount,
      totalClients,
      instances: instanceStatuses
    }
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)

    console.log('[InstanceManager] Cleanup interval started')
  }

  private cleanup(): void {
    const now = Date.now()
    const idleTimeout = 30 * 60 * 1000 // 30 minutes
    let removedCount = 0

    for (const [sessionId, entry] of this.instances.entries()) {
      const status = entry.instance.getStatus()

      // Remove stopped instances
      if (status.state === 'stopped') {
        this.instances.delete(sessionId)
        removedCount++
        continue
      }

      // Remove idle instances (no clients and no recent activity)
      const idleTime = now - entry.lastUsedAt.getTime()
      if (status.clientCount === 0 && idleTime > idleTimeout) {
        console.log('[InstanceManager] Removing idle instance', {
          sessionId,
          idleMinutes: (idleTime / (60 * 1000)).toFixed(2)
        })
        entry.instance.stop()
        this.instances.delete(sessionId)
        removedCount++
      }
    }

    if (removedCount > 0) {
      console.log('[InstanceManager] Cleanup complete', {
        removedCount,
        remainingInstances: this.instances.size
      })
    }
  }

  /**
   * Stop all instances
   */
  stopAll(): void {
    console.log('[InstanceManager] Stopping all instances', {
      count: this.instances.size
    })

    for (const entry of this.instances.values()) {
      entry.instance.stop()
    }

    this.instances.clear()
    this.clientToSession.clear()
  }

  // ========================================================================
  // EVENT CALLBACKS
  // ========================================================================

  onEvent(callback: (event: InstanceEvent) => void): () => void {
    this.eventCallbacks.add(callback)
    return () => this.eventCallbacks.delete(callback)
  }

  private notifyEventCallbacks(event: InstanceEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event)
      } catch (error) {
        console.error('[InstanceManager] Event callback error:', error)
      }
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let managerInstance: GatewayInstanceManager | null = null

/**
 * Get the singleton instance manager
 */
export function getInstanceManager(): GatewayInstanceManager {
  if (!managerInstance) {
    managerInstance = new GatewayInstanceManager()
    console.log('[InstanceManager] Singleton created')
  }
  return managerInstance
}

/**
 * Reset the instance manager (for testing)
 */
export function resetInstanceManager(): void {
  if (managerInstance) {
    managerInstance.stopAll()
  }
  managerInstance = null
}

// Re-export types
export type { InstanceEntry }
