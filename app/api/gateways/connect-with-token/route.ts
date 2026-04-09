import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import type { Gateway } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"


/**
 * @deprecated This endpoint is deprecated as of 2026-03-08
 *
 * Reason: Functionality merged into /api/gateways/[id]/connect
 * Use instead: POST /api/gateways/[id]/connect
 *
 * This endpoint is kept for backward compatibility but will be removed in future versions.
 *
 * Connect to a gateway using token-based authentication
 * This bypasses the pairing flow by using the gateway's auth token
 */
export async function POST(request: NextRequest) {
  logger.debug('[API:ConnectWithToken] Request received')
  
  try {
    await ensureDatabase()

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    const db = getDatabase()

    // Get current workspace from session
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { gatewayId, gatewayToken } = body

    if (!gatewayId) {
      logger.error('[API:ConnectWithToken] Gateway ID missing')
      return NextResponse.json(
        { message: 'Gateway ID is required' },
        { status: 400 }
      )
    }

    if (!gatewayToken) {
      logger.error('[API:ConnectWithToken] Gateway token missing')
      return NextResponse.json(
        { message: 'Gateway token is required' },
        { status: 400 }
      )
    }

    logger.debug('[API:ConnectWithToken] Connecting gateway with token', {
      gatewayId,
      hasToken: !!gatewayToken,
      workspaceId: session.current_workspace_id
    })

    // Get gateway from database
    const gateway = db
      .prepare(
        'SELECT * FROM gateways WHERE id = ? AND workspace_id = ?'
      )
      .get(gatewayId, session.current_workspace_id) as Gateway | undefined

    if (!gateway) {
      logger.error('[API:ConnectWithToken] Gateway not found', {
        gatewayId,
        workspaceId: session.current_workspace_id
      })
      return NextResponse.json(
        { message: 'Gateway not found' },
        { status: 404 }
      )
    }

    logger.debug('[API:ConnectWithToken] Gateway found', {
      gatewayId,
      gatewayUrl: gateway.url,
      gatewayName: gateway.name
    })

    // Store the gateway token
    db.prepare(
      'UPDATE gateways SET auth_token = ?, updated_at = ? WHERE id = ?'
    ).run(gatewayToken, new Date().toISOString(), gatewayId)
    
    logger.debug('[API:ConnectWithToken] Gateway token stored', {
      gatewayId
    })

    // Attempt to connect with token
    const manager = getGatewayManager()
    
    try {
      // Update status to connecting
      db.prepare(
        'UPDATE gateways SET status = ?, updated_at = ? WHERE id = ?'
      ).run('connecting', new Date().toISOString(), gatewayId)

      logger.debug('[API:ConnectWithToken] Attempting connection', {
        gatewayId,
        url: gateway.url
      })

      // Connect using the provided token
      const updatedGateway = { ...gateway, auth_token: gatewayToken }
      await manager.connectGateway(updatedGateway)

      // Check connection status
      const isConnected = manager.isConnected(gatewayId)
      
      logger.debug('[API:ConnectWithToken] Connection attempt completed', {
        gatewayId,
        isConnected
      })

      if (isConnected) {
        // Update status to connected
        db.prepare(
          'UPDATE gateways SET status = ?, last_connected_at = ?, last_error = NULL, updated_at = ? WHERE id = ?'
        ).run('connected', new Date().toISOString(), new Date().toISOString(), gatewayId)

        logger.debug('[API:ConnectWithToken] Gateway connected successfully', {
          gatewayId
        })

        return NextResponse.json({
          message: 'Gateway connected successfully with token',
          status: 'connected',
          connected: true
        })
      } else {
        // Connection failed
        db.prepare(
          'UPDATE gateways SET status = ?, last_error = ?, updated_at = ? WHERE id = ?'
        ).run('error', 'Connection failed after token authentication', new Date().toISOString(), gatewayId)

        logger.error('[API:ConnectWithToken] Connection failed', {
          gatewayId,
          error: 'Connection failed after token authentication'
        })

        return NextResponse.json(
          {
            message: 'Failed to connect with token',
            error: 'Connection failed',
            status: 'error'
          },
          { status: 500 }
        )
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      logger.error('[API:ConnectWithToken] Error during connection', {
        gatewayId,
        error: errorMessage
      })
      
      // Update status to error
      db.prepare(
        'UPDATE gateways SET status = ?, last_error = ?, updated_at = ? WHERE id = ?'
      ).run('error', errorMessage, new Date().toISOString(), gatewayId)

      return NextResponse.json(
        {
          message: 'Failed to connect to gateway with token',
          error: errorMessage,
          status: 'error'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('Error connecting gateway with token:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
