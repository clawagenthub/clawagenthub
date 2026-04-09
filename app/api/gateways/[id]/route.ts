import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import logger from "@/lib/logger/index.js"


export async function PUT(
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

    const gateway = db
      .prepare('SELECT id, url, auth_token FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, session.current_workspace_id) as { id: string; url: string; auth_token: string } | undefined

    if (!gateway) {
      return NextResponse.json(
        { message: 'Gateway not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, url, authToken } = body

    const updates: string[] = []
    const updateValues: (string | null)[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      updateValues.push(name.trim())
    }

    if (url !== undefined) {
      try {
        const parsedUrl = new URL(url)
        if (!['ws:', 'wss:'].includes(parsedUrl.protocol)) {
          return NextResponse.json(
            { message: 'Gateway URL must use ws:// or wss:// protocol' },
            { status: 400 }
          )
        }
        updates.push('url = ?')
        updateValues.push(url.trim())
      } catch {
        return NextResponse.json(
          { message: 'Invalid gateway URL format' },
          { status: 400 }
        )
      }
    }

    if (authToken !== undefined) {
      updates.push('auth_token = ?')
      updateValues.push(authToken.trim())
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { message: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    updateValues.push(gatewayId)

    db.prepare(
      `UPDATE gateways SET ${updates.join(', ')} WHERE id = ?`
    ).run(...updateValues)

    const updatedGateway = db
      .prepare('SELECT id, name, url, status, last_connected_at, last_error FROM gateways WHERE id = ?')
      .get(gatewayId)

    return NextResponse.json({
      message: 'Gateway updated successfully',
      gateway: updatedGateway
    })
  } catch (error) {
    logger.error('Error updating gateway:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Verify gateway belongs to current workspace
    const gateway = db
      .prepare('SELECT id FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, session.current_workspace_id)

    if (!gateway) {
      return NextResponse.json(
        { message: 'Gateway not found' },
        { status: 404 }
      )
    }

    // Disconnect if connected
    const manager = getGatewayManager()
    manager.disconnectGateway(gatewayId)

    // Delete from database
    db.prepare('DELETE FROM gateways WHERE id = ?').run(gatewayId)

    return NextResponse.json({
      message: 'Gateway deleted successfully'
    })
  } catch (error) {
    logger.error('Error deleting gateway:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
