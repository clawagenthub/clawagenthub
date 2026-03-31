import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import type { Gateway } from '@/lib/db/schema.js'

export async function POST(request: NextRequest) {
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
    const { gatewayId } = body

    if (!gatewayId) {
      return NextResponse.json(
        { message: 'Gateway ID is required' },
        { status: 400 }
      )
    }

    // Get gateway from database
    const gateway = db
      .prepare(
        'SELECT * FROM gateways WHERE id = ? AND workspace_id = ?'
      )
      .get(gatewayId, session.current_workspace_id) as Gateway | undefined

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
    console.error('Error checking gateway pairing:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
