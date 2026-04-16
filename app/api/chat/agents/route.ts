import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import type { AgentInfo } from '@/lib/db/schema'
import logger from '@/lib/logger/index.js'

function modelHasImageRecognition(model: unknown): boolean {
  if (!model) return false
  const modelName = String(model).toLowerCase()
  const indicators = [
    'vision',
    'vl-',
    'gpt-4v',
    'gpt-4-vision',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-5',
    'multimodal',
    'gemma3',
    'pixtral',
    'mistral-large',
    'commandr+',
    'gemini',
    'gpt-4.1',
    'gpt-4o',
  ]
  return indicators.some((indicator) => modelName.includes(indicator))
}

export async function GET(_request: Request) {
  logger.debug('[API /api/chat/agents] Starting request')

  try {
    const db = getDatabase()
    const manager = getGatewayManager()

    // Use global auth utility - replaces manual cookie parsing
    const auth = await getUserWithWorkspace()

    if (!auth) {
      logger.debug('[API /api/chat/agents] No valid session or workspace')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    logger.debug('[API /api/chat/agents] Authenticated:', {
      userId: auth.user.id,
      workspaceId: auth.workspaceId,
    })

    // Get all gateways for the current workspace
    const gateways = db
      .prepare(
        `SELECT * FROM gateways WHERE workspace_id = ? AND status = 'connected'`
      )
      .all(auth.workspaceId) as Array<{
      id: string
      name: string
      workspace_id: string
    }>

    logger.debug('[API /api/chat/agents] Found gateways:', {
      count: gateways.length,
      gateways: gateways.map((g) => ({ id: g.id, name: g.name })),
    })

    const agents: AgentInfo[] = []

    // Fetch agents from each connected gateway
    for (const gateway of gateways) {
      logger.debug(
        `[API /api/chat/agents] Processing gateway: ${gateway.name} (${gateway.id})`
      )

      try {
        const client = manager.getClient(gateway.id)
        logger.debug(`[API /api/chat/agents] Gateway ${gateway.name} client:`, {
          hasClient: !!client,
          isConnected: client?.isConnected(),
        })

        if (!client || !client.isConnected()) {
          logger.debug(
            `[API /api/chat/agents] Gateway ${gateway.id} not connected, skipping`
          )
          continue
        }

        logger.debug(
          `[API /api/chat/agents] Calling listAgents() for gateway ${gateway.name}`
        )
        const gatewayAgents = await client.listAgents()

        logger.debug(
          `[API /api/chat/agents] Gateway ${gateway.name} returned agents:`,
          {
            count: gatewayAgents.length,
            agents: gatewayAgents,
          }
        )

        for (const agent of gatewayAgents) {
          const agentInfo: AgentInfo = {
            gatewayId: gateway.id,
            gatewayName: gateway.name,
            agentId: agent.id,
            agentName: agent.name || agent.id,
            sessionKey: agent.sessionKey || `agent:${agent.id}:main`,
            model: agent.model || null,
            capabilities: {
              imageRecognition:
                agent.capabilities?.imageRecognition ??
                modelHasImageRecognition(agent.model),
            },
          }
          logger.debug(`[API /api/chat/agents] Adding agent:`, agentInfo)
          agents.push(agentInfo)
        }
      } catch (error) {
        logger.error(
          `[API /api/chat/agents] Error fetching agents from gateway ${gateway.id}:`,
          {
            error,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }
        )
        // Continue with other gateways
      }
    }

    // logger.debug('[API /api/chat/agents] Final agents list:', {
    //   count: agents.length,
    //   agents
    // })

    return NextResponse.json({ agents })
  } catch (error) {
    logger.error('[API /api/chat/agents] Fatal error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}
