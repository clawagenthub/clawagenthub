import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import logger from "@/lib/logger/index.js"

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

/**
 * GET /api/{sessionId}/agent-tools
 * List available agent tools (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

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
  } catch (error) {
    logger.error('[API /api/{sessionId}/agent-tools] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 })
  }
}

/**
 * POST /api/{sessionId}/agent-tools
 * Execute an agent tool (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  logger.debug('[API /api/{sessionId}/agent-tools] Starting request')

  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    await ensureDatabase()
    const db = getDatabase()
    const manager = getGatewayManager()

    const body: AgentToolRequest = await request.json()
    const { ticketId, agentId, gatewayId, tool, params: toolParams } = body

    // Validate required fields
    if (!ticketId || !agentId || !gatewayId || !tool) {
      return NextResponse.json(
        { error: 'Missing required fields: ticketId, agentId, gatewayId, tool' },
        { status: 400 }
      )
    }

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Verify ticket exists and belongs to workspace
    const ticket = db
      .prepare('SELECT * FROM tickets WHERE id = ? AND workspace_id = ?')
      .get(ticketId, workspaceId) as { id: string; status_id: string } | undefined

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Verify gateway exists and belongs to workspace
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, workspaceId) as { id: string; url: string } | undefined

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
          if (!toolParams?.url) {
            return NextResponse.json(
              { error: 'Missing required param: url for curl tool' },
              { status: 400 }
            )
          }

          result = await client.call('agent.tools.call', {
            agentId,
            tool: 'curl',
            params: {
              url: toolParams.url,
              method: toolParams.method || 'GET',
              headers: toolParams.headers,
              body: toolParams.body,
            }
          })
          break
        }

        case 'searxng': {
          if (!toolParams?.query) {
            return NextResponse.json(
              { error: 'Missing required param: query for searxng tool' },
              { status: 400 }
            )
          }

          result = await client.call('agent.tools.call', {
            agentId,
            tool: 'searxng',
            params: {
              query: toolParams.query,
              category: toolParams.category,
              engines: toolParams.engines,
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

      logger.debug('[API /api/{sessionId}/agent-tools] Tool execution successful:', {
        tool,
        ticketId,
        agentId
      })

      return NextResponse.json({
        success: true,
        result,
      })
    } catch (toolError) {
      error = toolError instanceof Error ? toolError.message : String(toolError)
      logger.error('[API /api/{sessionId}/agent-tools] Tool execution failed:', {
        tool,
        ticketId,
        agentId,
        error
      })

      return NextResponse.json({
        success: false,
        error,
      }, { status: 500 })
    }
  } catch (error) {
    logger.error('[API /api/{sessionId}/agent-tools] Fatal error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to execute agent tool' },
      { status: 500 }
    )
  }
}
