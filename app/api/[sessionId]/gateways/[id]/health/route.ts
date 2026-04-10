import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import type { Gateway } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * POST /api/{sessionId}/gateways/[id]/health
 * Health check endpoint for gateway (session-scoped)
 * Tests if the gateway is reachable and authentication is working
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { sessionId, id: gatewayId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
      workspaceId: sessionId
    })

    if (!verification.valid) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    // Get gateway from database
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, workspaceId) as Gateway | undefined

    if (!gateway) {
      return NextResponse.json(
        { message: 'Gateway not found' },
        { status: 404 }
      )
    }

    // Check if gateway has auth token
    if (!gateway.auth_token) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'Gateway has no auth token configured',
          checks: {
            hasToken: false,
            isConnected: false,
            canAuthenticate: false
          }
        },
        { status: 200 }
      )
    }

    const manager = getGatewayManager()
    
    // Check if gateway is connected
    const isConnected = manager.isConnected(gatewayId)
    
    if (!isConnected) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'Gateway is not connected',
          checks: {
            hasToken: true,
            isConnected: false,
            canAuthenticate: false
          }
        },
        { status: 200 }
      )
    }

    // Try to get gateway client and verify it's authenticated
    const client = manager.getClient(gatewayId)
    
    if (!client) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'Gateway client not found',
          checks: {
            hasToken: true,
            isConnected: false,
            canAuthenticate: false
          }
        },
        { status: 200 }
      )
    }

    // Check if client is authenticated
    const isAuthenticated = client.isAuthenticated()
    
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'Gateway authentication failed',
          checks: {
            hasToken: true,
            isConnected: true,
            canAuthenticate: false
          }
        },
        { status: 200 }
      )
    }

    // All checks passed!
    return NextResponse.json({
      healthy: true,
      message: 'Gateway is healthy and authenticated',
      checks: {
        hasToken: true,
        isConnected: true,
        canAuthenticate: true
      },
      gateway: {
        id: gateway.id,
        name: gateway.name,
        url: gateway.url,
        status: gateway.status,
        lastConnected: gateway.last_connected_at
      }
    })

  } catch (error) {
    logger.error('Error checking gateway health (session-scoped):', error)
    return NextResponse.json(
      {
        healthy: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
