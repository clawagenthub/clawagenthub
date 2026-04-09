import { GatewayClient } from './client.js'
import type { Gateway } from '../db/schema.js'
import { getDatabase } from '../db/index.js'
import { getGatewayEventBridge } from './event-bridge.js'
import logger, { logCategories } from '@/lib/logger/index.js'

export interface ConnectionStatus {
  connected: boolean
  error?: string
  lastChecked: Date
}

export class GatewayManager {
  private connections: Map<string, GatewayClient> = new Map()
  private statuses: Map<string, ConnectionStatus> = new Map()

  async connectGateway(gateway: Gateway, origin?: string | null): Promise<void> {
    logger.info({ category: logCategories.GATEWAY_MANAGER }, 'Connecting to gateway %s (%s)', gateway.id, gateway.url)

    if (!gateway.auth_token) {
      throw new Error('Gateway auth token is required')
    }

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
      logger.info({ category: logCategories.GATEWAY_MANAGER }, 'Gateway %s connected successfully', gateway.id)

      const bridge = getGatewayEventBridge()
      bridge.registerGateway(gateway.id)
      if (!bridge.isRunning()) {
        bridge.start()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error({ category: logCategories.GATEWAY_MANAGER }, 'Failed to connect gateway %s: %s', gateway.id, errorMessage)
      this.statuses.set(gateway.id, {
        connected: false,
        error: errorMessage,
        lastChecked: new Date(),
      })
      throw error
    }
  }

  disconnectGateway(gatewayId: string): void {
    const client = this.connections.get(gatewayId)
    logger.info({ category: logCategories.GATEWAY_MANAGER }, 'Disconnecting gateway %s', gatewayId)
    if (client) {
      client.disconnect()
      this.connections.delete(gatewayId)
    }
    this.statuses.delete(gatewayId)

    const bridge = getGatewayEventBridge()
    bridge.unregisterGateway(gatewayId)
  }

  getConnection(gatewayId: string): GatewayClient | null {
    return this.connections.get(gatewayId) ?? null
  }

  getClient(gatewayId: string): GatewayClient | undefined {
    return this.connections.get(gatewayId)
  }

  getStatus(gatewayId: string): ConnectionStatus | null {
    return this.statuses.get(gatewayId) ?? null
  }

  async testConnection(url: string, authToken: string): Promise<boolean> {
    logger.debug({ category: logCategories.GATEWAY_MANAGER }, 'Testing connection to %s', url)

    if (!authToken) {
      logger.error({ category: logCategories.GATEWAY_MANAGER }, 'Auth token is required for connection test')
      return false
    }

    const client = new GatewayClient(url, { authToken })
    try {
      await client.connect()
      const health = await client.health()
      client.disconnect()
      const success = health.ok === true
      logger.debug({ category: logCategories.GATEWAY_MANAGER }, 'Connection test to %s: %s', url, success ? 'success' : 'failed')
      return success
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_MANAGER }, 'Connection test to %s failed: %s', url, String(error))
      return false
    }
  }

  isConnected(gatewayId: string): boolean {
    const client = this.connections.get(gatewayId)
    const connected = client?.isConnected() ?? false
    logger.debug({ category: logCategories.GATEWAY_MANAGER }, 'Connection status for %s: %s', gatewayId, connected)
    return connected
  }

  disconnectAll(): void {
    for (const gatewayId of this.connections.keys()) {
      this.disconnectGateway(gatewayId)
    }
  }

  async initializeGateways(): Promise<void> {
    logger.info({ category: logCategories.GATEWAY_MANAGER }, 'Initializing gateway connections from database')

    try {
      const db = getDatabase()
      const gateways = db
        .prepare(`SELECT * FROM gateways WHERE status = 'connected'`)
        .all() as Gateway[]

      logger.info({ category: logCategories.GATEWAY_MANAGER }, 'Found %s gateways to connect', gateways.length)

      for (const gateway of gateways) {
        try {
          logger.info({ category: logCategories.GATEWAY_MANAGER }, 'Connecting to gateway: %s (%s)', gateway.name, gateway.id)
          await this.connectGateway(gateway)
          logger.info({ category: logCategories.GATEWAY_MANAGER }, 'Connected to gateway: %s', gateway.name)
        } catch (error) {
          logger.error({ category: logCategories.GATEWAY_MANAGER }, 'Failed to connect to gateway %s: %s', gateway.name, String(error))
        }
      }

      logger.info({ category: logCategories.GATEWAY_MANAGER }, 'Gateway initialization complete: %s/%s connected', this.connections.size, gateways.length)
    } catch (error) {
      logger.error({ category: logCategories.GATEWAY_MANAGER }, 'Failed to initialize gateways: %s', String(error))
    }
  }
}

let managerInstance: GatewayManager | null = null
let initialized = false

export function getGatewayManager(): GatewayManager {
  if (!managerInstance) {
    managerInstance = new GatewayManager()

    if (!initialized) {
      initialized = true
      managerInstance.initializeGateways().catch(err => {
        logger.error({ category: logCategories.GATEWAY_MANAGER }, 'Background initialization failed: %s', String(err))
      })
    }
  }
  return managerInstance
}
