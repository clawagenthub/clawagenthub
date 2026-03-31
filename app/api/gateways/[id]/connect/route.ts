import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession, getSessionOrigin } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import type { Gateway } from '@/lib/db/schema.js'

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

    const gatewayId = params.id

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

    if (!gateway.auth_token) {
      return NextResponse.json(
        { message: 'Gateway auth token not configured' },
        { status: 400 }
      )
    }

    // Get origin from session
    const origin = getSessionOrigin(sessionToken)
    console.log('[API:Connect] Session origin:', origin)

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
    console.error('Error connecting gateway:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
