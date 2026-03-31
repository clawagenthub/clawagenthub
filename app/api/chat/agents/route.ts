import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import type { AgentInfo } from '@/lib/db/schema'

export async function GET(request: Request) {
  console.log('[API /api/chat/agents] Starting request')
  
  try {
    const db = getDatabase()
    const manager = getGatewayManager()

    // Use global auth utility - replaces manual cookie parsing
    const auth = await getUserWithWorkspace()
    
    if (!auth) {
      console.log('[API /api/chat/agents] No valid session or workspace')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }
    
    console.log('[API /api/chat/agents] Authenticated:', {
      userId: auth.user.id,
      workspaceId: auth.workspaceId
    })

    // Get all gateways for the current workspace
    const gateways = db
      .prepare(`SELECT * FROM gateways WHERE workspace_id = ? AND status = 'connected'`)
      .all(auth.workspaceId) as Array<{
      id: string
      name: string
      workspace_id: string
    }>

    console.log('[API /api/chat/agents] Found gateways:', {
      count: gateways.length,
      gateways: gateways.map(g => ({ id: g.id, name: g.name }))
    })

    const agents: AgentInfo[] = []

    // Fetch agents from each connected gateway
    for (const gateway of gateways) {
      console.log(`[API /api/chat/agents] Processing gateway: ${gateway.name} (${gateway.id})`)
      
      try {
        const client = manager.getClient(gateway.id)
        console.log(`[API /api/chat/agents] Gateway ${gateway.name} client:`, {
          hasClient: !!client,
          isConnected: client?.isConnected()
        })
        
        if (!client || !client.isConnected()) {
          console.log(`[API /api/chat/agents] Gateway ${gateway.id} not connected, skipping`)
          continue
        }

        console.log(`[API /api/chat/agents] Calling listAgents() for gateway ${gateway.name}`)
        const gatewayAgents = await client.listAgents()
        
        console.log(`[API /api/chat/agents] Gateway ${gateway.name} returned agents:`, {
          count: gatewayAgents.length,
          agents: gatewayAgents
        })
        
        for (const agent of gatewayAgents) {
          const agentInfo = {
            gatewayId: gateway.id,
            gatewayName: gateway.name,
            agentId: agent.id,
            agentName: agent.name || agent.id,
            sessionKey: agent.sessionKey || `agent:${agent.id}:main`
          }
          console.log(`[API /api/chat/agents] Adding agent:`, agentInfo)
          agents.push(agentInfo)
        }
      } catch (error) {
        console.error(`[API /api/chat/agents] Error fetching agents from gateway ${gateway.id}:`, {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
        // Continue with other gateways
      }
    }

    // console.log('[API /api/chat/agents] Final agents list:', {
    //   count: agents.length,
    //   agents
    // })
    
    return NextResponse.json({ agents })
  } catch (error) {
    console.error('[API /api/chat/agents] Fatal error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}
