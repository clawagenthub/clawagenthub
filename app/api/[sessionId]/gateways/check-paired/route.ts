import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import type { Gateway } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

/**
 * POST /api/{sessionId}/gateways/check-paired
 * Check pairing status of a gateway (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    await ensureDatabase()

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

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { gatewayId } = body

    if (!gatewayId) {
      return NextResponse.json(
        { message: 'Gateway ID is required' },
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

    // Check connection status
    const manager = getGatewayManager()
    const isConnected = manager.isConnected(gatewayId)

    if (isConnected) {
      // Try to get status from gateway
      try {
        const client = manager.getConnection(gatewayId)
        if (client) {
          const status = await client.status()
          
          // Update database
          db.prepare(
            'UPDATE gateways SET status = ?, last_connected_at = ?, last_error = NULL, updated_at = ? WHERE id = ?'
          ).run('connected', new Date().toISOString(), new Date().toISOString(), gatewayId)

          return NextResponse.json({
            connected: true,
            status: 'connected',
            gatewayStatus: status
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // Update database with error
        db.prepare(
          'UPDATE gateways SET status = ?, last_error = ?, updated_at = ? WHERE id = ?'
        ).run('error', errorMessage, new Date().toISOString(), gatewayId)

        return NextResponse.json({
          connected: false,
          status: 'error',
          error: errorMessage
        })
      }
    }

    // Not connected
    db.prepare(
      'UPDATE gateways SET status = ?, updated_at = ? WHERE id = ?'
    ).run('disconnected', new Date().toISOString(), gatewayId)

    return NextResponse.json({
      connected: false,
      status: 'disconnected'
    })
  } catch (error) {
    logger.error('Error checking gateway pairing (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
