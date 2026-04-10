import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getSessionOrigin } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import type { Gateway } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * POST /api/{sessionId}/gateways/[id]/connect
 * Connect to a gateway (session-scoped)
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
      .prepare(
        'SELECT * FROM gateways WHERE id = ? AND workspace_id = ?'
      )
      .get(gatewayId, workspaceId) as Gateway | undefined

    if (!gateway) {
      return NextResponse.json(
        { message: 'Gateway not found' },
        { status: 404 }
      )
    }

    if (!gateway.auth_token) {
      return NextResponse.json(
        { message: 'Gateway auth token not configured' },
        { status: 400 }
      )
    }

    // Get origin from session
    const origin = getSessionOrigin(sessionId)
    logger.debug('[API:Connect] Session origin:', origin)

    // Attempt to connect
    const manager = getGatewayManager()
    
    try {
      // Update status to connecting
      db.prepare(
        'UPDATE gateways SET status = ?, updated_at = ? WHERE id = ?'
      ).run('connecting', new Date().toISOString(), gatewayId)

      await manager.connectGateway(gateway, origin)

      // Update status to connected
      db.prepare(
        'UPDATE gateways SET status = ?, last_connected_at = ?, last_error = NULL, updated_at = ? WHERE id = ?'
      ).run('connected', new Date().toISOString(), new Date().toISOString(), gatewayId)

      return NextResponse.json({
        message: 'Gateway connected successfully',
        status: 'connected'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Update status to error
      db.prepare(
        'UPDATE gateways SET status = ?, last_error = ?, updated_at = ? WHERE id = ?'
      ).run('error', errorMessage, new Date().toISOString(), gatewayId)

      return NextResponse.json(
        {
          message: 'Failed to connect to gateway',
          error: errorMessage,
          status: 'error'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('Error connecting gateway (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
