import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import type { Gateway } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'


/**
 * Health check endpoint for gateway
 * Tests if the gateway is reachable and authentication is working
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureDatabase()

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)
    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabase()
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const gatewayId = params.id

    // Get gateway from database
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, session.current_workspace_id) as Gateway | undefined

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
    logger.error('Error checking gateway health:', error)
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
