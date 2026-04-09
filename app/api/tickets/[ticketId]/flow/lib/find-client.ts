import type { AgentClientMatch } from './flow-types.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager'
import logger, { logCategories } from '@/lib/logger/index.js'


/**
 * Find a connected client for the specified agent
 */
export async function findClientForAgent(workspaceId: string, agentId: string): Promise<AgentClientMatch | null> {
  const db = getDatabase()
  const manager = getGatewayManager()
  const gateways = db.prepare(
    'SELECT id, name FROM gateways WHERE workspace_id = ? ORDER BY created_at ASC'
  ).all(workspaceId) as Array<{ id: string; name: string }>

  logger.debug(`[findClientForAgent] Looking for agent ${agentId} in ${gateways.length} gateways`)

  for (const gateway of gateways) {
    const client = manager.getClient(gateway.id)
    logger.debug(`[findClientForAgent] Gateway ${gateway.name}: client=${!!client}, connected=${client?.isConnected()}`)

    if (!client || !client.isConnected()) continue
    try {
      const agents = await client.listAgents()
      logger.debug(`[findClientForAgent] Gateway ${gateway.name} returned ${agents.length} agents:`, agents.map(a => a.id))

      const matchingAgent = agents.find((a) => a.id === agentId)
      if (matchingAgent) {
        logger.debug(`[findClientForAgent] Found matching agent ${agentId} in gateway ${gateway.name}`)
        return { client, gatewayId: gateway.id, gatewayName: gateway.name, agentModel: matchingAgent.model, agentName: matchingAgent.name || agentId }
      }
    } catch (err) {
      logger.error(`[findClientForAgent] Error listing agents for gateway ${gateway.name}:`, err)
    }
  }

  logger.debug(`[findClientForAgent] Agent ${agentId} not found in any gateway`)
  return null
}
