import { GatewayClient } from './client.js'
import type { Gateway } from '../db/schema.js'
import { getDatabase } from '../db/index.js'
import { getGatewayEventBridge } from './event-bridge.js'

export interface ConnectionStatus {
  connected: boolean
  error?: string
  lastChecked: Date
}

export class GatewayManager {
  private connections: Map<string, GatewayClient> = new Map()
  private statuses: Map<string, ConnectionStatus> = new Map()

  /**
   * Connect to a gateway with optional origin override
   */
  async connectGateway(gateway: Gateway, origin?: string | null): Promise<void> {
    console.log('[GatewayManager] Connecting to gateway', {
      gatewayId: gateway.id,
      url: gateway.url,
      hasAuthToken: !!gateway.auth_token,
      origin: origin || 'auto-detect'
    })
    
    if (!gateway.auth_token) {
      throw new Error('Gateway auth token is required')
    }
    
    // Disconnect existing connection if any
    this.disconnectGateway(gateway.id)

    const client = new GatewayClient(gateway.url, {
      authToken: gateway.auth_token,
      origin: origin ?? undefined,
    })

    try {
      await client.connect()
      this.connections.set(gateway.id, client)
      this.statuses.set(gateway.id, {
        connected: true,
        lastChecked: new Date(),
      })
      console.log('[GatewayManager] Gateway connected successfully', {
        gatewayId: gateway.id
      })
      
      // Register gateway for event forwarding
      const bridge = getGatewayEventBridge()
      bridge.registerGateway(gateway.id)
      // Start bridge if not already running
      if (!bridge.isRunning()) {
        bridge.start()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[GatewayManager] Failed to connect gateway', {
        gatewayId: gateway.id,
        error: errorMessage
      })
      this.statuses.set(gateway.id, {
        connected: false,
        error: errorMessage,
        lastChecked: new Date(),
      })
      throw error
    }
  }

  /**
   * Disconnect from a gateway
   */
  disconnectGateway(gatewayId: string): void {
    const client = this.connections.get(gatewayId)
    console.log('[GatewayManager] Disconnecting gateway', {
      gatewayId,
      hadConnection: !!client
    })
    if (client) {
      client.disconnect()
      this.connections.delete(gatewayId)
    }
    this.statuses.delete(gatewayId)
    
    // Unregister gateway from event forwarding
    const bridge = getGatewayEventBridge()
    bridge.unregisterGateway(gatewayId)
  }

  /**
   * Get connection for a gateway
   */
  getConnection(gatewayId: string): GatewayClient | null {
    return this.connections.get(gatewayId) ?? null
  }

  /**
   * Get the gateway client for a specific gateway
   */
  getClient(gatewayId: string): GatewayClient | undefined {
    return this.connections.get(gatewayId)
  }

  /**
   * Get connection status
   */
  getStatus(gatewayId: string): ConnectionStatus | null {
    return this.statuses.get(gatewayId) ?? null
  }

  /**
   * Test connection to a gateway without storing it
   */
  async testConnection(url: string, authToken: string): Promise<boolean> {
    console.log('[GatewayManager] Testing connection', {
      url,
      hasAuthToken: !!authToken
    })
    
    if (!authToken) {
      console.error('[GatewayManager] Auth token is required for connection test')
      return false
    }
    
    const client = new GatewayClient(url, { authToken })
    try {
      await client.connect()
      const health = await client.health()
      client.disconnect()
      const success = health.ok === true
      console.log('[GatewayManager] Connection test result', {
        url,
        success
      })
      return success
    } catch (error) {
      console.error('[GatewayManager] Connection test failed', {
        url,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Check if gateway is connected
   */
  isConnected(gatewayId: string): boolean {
    const client = this.connections.get(gatewayId)
    const connected = client?.isConnected() ?? false
    console.log('[GatewayManager] Connection status check', {
      gatewayId,
      connected
    })
    return connected
  }

  /**
   * Disconnect all gateways
   */
  disconnectAll(): void {
    for (const gatewayId of this.connections.keys()) {
      this.disconnectGateway(gatewayId)
    }
  }

  /**
   * Initialize connections to all gateways in the database
   * Should be called on server startup
   */
  async initializeGateways(): Promise<void> {
    console.log('[GatewayManager] Initializing gateway connections from database')
    
    try {
      const db = getDatabase()
      const gateways = db
        .prepare(`SELECT * FROM gateways WHERE status = 'connected'`)
        .all() as Gateway[]
      
      console.log('[GatewayManager] Found gateways to connect:', {
        count: gateways.length,
        gateways: gateways.map(g => ({ id: g.id, name: g.name, url: g.url }))
      })
      
      for (const gateway of gateways) {
        try {
          console.log(`[GatewayManager] Connecting to gateway: ${gateway.name} (${gateway.id})`)
          await this.connectGateway(gateway)
          console.log(`[GatewayManager] ✓ Connected to gateway: ${gateway.name}`)
        } catch (error) {
          console.error(`[GatewayManager] ✗ Failed to connect to gateway: ${gateway.name}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          // Continue with other gateways even if one fails
        }
      }
      
      console.log('[GatewayManager] Gateway initialization complete', {
        total: gateways.length,
        connected: this.connections.size
      })
    } catch (error) {
      console.error('[GatewayManager] Failed to initialize gateways:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }
}

// Singleton instance for server-side usage
let managerInstance: GatewayManager | null = null
let initialized = false

export function getGatewayManager(): GatewayManager {
  if (!managerInstance) {
    managerInstance = new GatewayManager()
    
    // Auto-initialize on first access (lazy initialization)
    if (!initialized) {
      initialized = true
      // Don't await - let it initialize in background
      managerInstance.initializeGateways().catch(err => {
        console.error('[GatewayManager] Background initialization failed:', err)
      })
    }
  }
  return managerInstance
}
