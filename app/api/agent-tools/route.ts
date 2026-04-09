import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import logger, { logCategories } from '@/lib/logger/index.js'


interface AgentToolRequest {
  ticketId: string
  agentId: string
  gatewayId: string
  tool: 'curl' | 'searxng'
  params: {
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
    query?: string
    category?: string
    engines?: string[]
  }
}

interface AgentToolResponse {
  success: boolean
  result?: unknown
  error?: string
}

export async function POST(request: Request) {
  logger.debug('[API /api/agent-tools] Starting request')
  
  try {
    const db = getDatabase()
    const manager = getGatewayManager()

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    
    if (!auth) {
      logger.debug('[API /api/agent-tools] No valid session or workspace')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }
    
    logger.debug('[API /api/agent-tools] Authenticated:', {
      userId: auth.user.id,
      workspaceId: auth.workspaceId
    })

    const body: AgentToolRequest = await request.json()
    const { ticketId, agentId, gatewayId, tool, params } = body

    // Validate required fields
    if (!ticketId || !agentId || !gatewayId || !tool) {
      return NextResponse.json(
        { error: 'Missing required fields: ticketId, agentId, gatewayId, tool' },
        { status: 400 }
      )
    }

    // Verify ticket exists and belongs to workspace
    const ticket = db
      .prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?')
      .get(ticketId, auth.workspaceId) as { id: string; status_id: string } | undefined

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Verify gateway exists and belongs to workspace
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, auth.workspaceId) as { id: string; url: string } | undefined

    if (!gateway) {
      return NextResponse.json({ error: 'Gateway not found' }, { status: 404 })
    }

    // Get gateway client
    const client = manager.getClient(gatewayId)
    if (!client || !client.isConnected()) {
      return NextResponse.json(
        { error: 'Gateway not connected' },
        { status: 503 }
      )
    }

    let result: unknown
    let error: string | undefined

    try {
      switch (tool) {
        case 'curl': {
          // Call the agent's curl tool
          if (!params.url) {
            return NextResponse.json(
              { error: 'Missing required param: url for curl tool' },
              { status: 400 }
            )
          }

          result = await client.call('agent.tools.call', {
            agentId,
            tool: 'curl',
            params: {
              url: params.url,
              method: params.method || 'GET',
              headers: params.headers,
              body: params.body,
            }
          })
          break
        }

        case 'searxng': {
          // Call the agent's searxng tool
          if (!params.query) {
            return NextResponse.json(
              { error: 'Missing required param: query for searxng tool' },
              { status: 400 }
            )
          }

          result = await client.call('agent.tools.call', {
            agentId,
            tool: 'searxng',
            params: {
              query: params.query,
              category: params.category,
              engines: params.engines,
            }
          })
          break
        }

        default:
          return NextResponse.json(
            { error: `Unknown tool: ${tool}` },
            { status: 400 }
          )
      }

      logger.debug('[API /api/agent-tools] Tool execution successful:', {
        tool,
        ticketId,
        agentId
      })

      const response: AgentToolResponse = {
        success: true,
        result,
      }

      return NextResponse.json(response)
    } catch (toolError) {
      error = toolError instanceof Error ? toolError.message : String(toolError)
      logger.error('[API /api/agent-tools] Tool execution failed:', {
        tool,
        ticketId,
        agentId,
        error
      })

      const response: AgentToolResponse = {
        success: false,
        error,
      }

      return NextResponse.json(response, { status: 500 })
    }
  } catch (error) {
    logger.error('[API /api/agent-tools] Fatal error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to execute agent tool' },
      { status: 500 }
    )
  }
}

// GET endpoint to list available tools
export async function GET() {
  const tools = [
    {
      name: 'curl',
      description: 'Make HTTP requests',
      params: {
        url: { type: 'string', required: true },
        method: { type: 'string', default: 'GET', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
        headers: { type: 'object' },
        body: { type: 'string' },
      }
    },
    {
      name: 'searxng',
      description: 'Search the web using SearXNG',
      params: {
        query: { type: 'string', required: true },
        category: { type: 'string', enum: ['general', 'images', 'videos', 'news', 'map', 'music', 'it', 'science'] },
        engines: { type: 'array', items: { type: 'string' } },
      }
    }
  ]

  return NextResponse.json({ tools })
}
