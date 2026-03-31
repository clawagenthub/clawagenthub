/**
 * Gateway Bridge Configuration
 * 
 * Reads gateway configuration from the SQLite database.
 * This is used by the session instance manager to connect to gateways.
 */

import { getDatabase } from '../db/index.js'
import type { Gateway } from '../db/schema.js'

// ============================================================================
// TYPES
// ============================================================================

/** Gateway configuration from database */
export interface GatewayConfig {
  id: string
  name: string
  url: string
  authToken: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
}

/** Agent configuration for session instances */
export interface AgentConfig {
  agentId: string
  sessionKey: string
}

// ============================================================================
// CONFIGURATION FUNCTIONS
// ============================================================================

/**
 * Get all gateways from the database
 */
export function getAllGateways(): GatewayConfig[] {
  try {
    const db = getDatabase()
    const gateways = db
      .prepare(`SELECT * FROM gateways`)
      .all() as Gateway[]

    return gateways.map(g => ({
      id: g.id,
      name: g.name,
      url: g.url,
      authToken: g.auth_token,
      status: g.status as GatewayConfig['status']
    }))
  } catch (error) {
    console.error('[GatewayConfig] Failed to get gateways:', error)
    return []
  }
}

/**
 * Get a specific gateway by ID
 */
export function getGatewayById(gatewayId: string): GatewayConfig | null {
  try {
    const db = getDatabase()
    const gateway = db
      .prepare(`SELECT * FROM gateways WHERE id = ?`)
      .get(gatewayId) as Gateway | undefined

    if (!gateway) {
      return null
    }

    return {
      id: gateway.id,
      name: gateway.name,
      url: gateway.url,
      authToken: gateway.auth_token,
      status: gateway.status as GatewayConfig['status']
    }
  } catch (error) {
    console.error('[GatewayConfig] Failed to get gateway:', error)
    return null
  }
}

/**
 * Get connected gateways from the database
 */
export function getConnectedGateways(): GatewayConfig[] {
  try {
    const db = getDatabase()
    const gateways = db
      .prepare(`SELECT * FROM gateways WHERE status = 'connected'`)
      .all() as Gateway[]

    return gateways.map(g => ({
      id: g.id,
      name: g.name,
      url: g.url,
      authToken: g.auth_token,
      status: g.status as GatewayConfig['status']
    }))
  } catch (error) {
    console.error('[GatewayConfig] Failed to get connected gateways:', error)
    return []
  }
}

/**
 * Get the first connected gateway (for default routing)
 */
export function getDefaultGateway(): GatewayConfig | null {
  const connected = getConnectedGateways()
  return connected.length > 0 ? connected[0] : null
}

/**
 * Update gateway status in the database
 */
export function updateGatewayStatus(
  gatewayId: string,
  status: GatewayConfig['status'],
  error?: string
): void {
  try {
    const db = getDatabase()
    
    if (error) {
      db.prepare(`
        UPDATE gateways 
        SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(status, error, gatewayId)
    } else {
      db.prepare(`
        UPDATE gateways 
        SET status = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(status, gatewayId)
    }

    if (status === 'connected') {
      db.prepare(`
        UPDATE gateways 
        SET last_connected_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(gatewayId)
    }
  } catch (error) {
    console.error('[GatewayConfig] Failed to update gateway status:', error)
  }
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

/**
 * Get session key for an agent
 * Session keys follow the format: agent:{agentId}:main
 */
export function getAgentSessionKey(agentId: string): string {
  return `agent:${agentId}:main`
}

/**
 * Parse agent ID from session key
 */
export function parseAgentIdFromSessionKey(sessionKey: string): string | null {
  const match = sessionKey.match(/^agent:([^:]+):/)
  return match ? match[1] : null
}

/**
 * Check if a session key is valid
 */
export function isValidSessionKey(sessionKey: string): boolean {
  return /^agent:[^:]+:\w+$/.test(sessionKey)
}

// ============================================================================
// WORKSPACE CONTEXT
// ============================================================================

/**
 * Get gateways for a specific workspace
 */
export function getWorkspaceGateways(workspaceId: string): GatewayConfig[] {
  try {
    const db = getDatabase()
    const gateways = db
      .prepare(`SELECT * FROM gateways WHERE workspace_id = ?`)
      .all(workspaceId) as Gateway[]

    return gateways.map(g => ({
      id: g.id,
      name: g.name,
      url: g.url,
      authToken: g.auth_token,
      status: g.status as GatewayConfig['status']
    }))
  } catch (error) {
    console.error('[GatewayConfig] Failed to get workspace gateways:', error)
    return []
  }
}
