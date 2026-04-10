import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/chat/agents
 * Get available agents for the current workspace (session-scoped)
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

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Get gateways with their agents
    const gateways = db
      .prepare(`
        SELECT g.id as gateway_id, g.name as gateway_name, g.url as gateway_url, g.status as gateway_status,
               s.id as skill_id, s.skill_name, s.skill_description
        FROM gateways g
        LEFT JOIN skills s ON s.workspace_id = g.workspace_id AND s.is_active = 1
        WHERE g.workspace_id = ?
        ORDER BY g.name, s.skill_name
      `)
      .all(workspaceId) as any[]

    // Group agents by gateway
    const gatewayMap = new Map<string, any>()
    for (const row of gateways) {
      if (!gatewayMap.has(row.gateway_id)) {
        gatewayMap.set(row.gateway_id, {
          gateway_id: row.gateway_id,
          gateway_name: row.gateway_name,
          gateway_url: row.gateway_url,
          gateway_status: row.gateway_status,
          agents: []
        })
      }
      if (row.skill_id) {
        const agent = gatewayMap.get(row.gateway_id)
        agent.agents.push({
          skill_id: row.skill_id,
          skill_name: row.skill_name,
          skill_description: row.skill_description
        })
      }
    }

    const agents = Array.from(gatewayMap.values())

    return NextResponse.json({ agents })
  } catch (error) {
    logger.error('[Chat API] Error fetching agents (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}
