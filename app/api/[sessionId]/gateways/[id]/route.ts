import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * PUT /api/{sessionId}/gateways/[id]
 * Update a gateway (session-scoped)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id: gatewayId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.user) {
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

    const gateway = db
      .prepare('SELECT id, url, auth_token FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, workspaceId) as { id: string; url: string; auth_token: string } | undefined

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
    logger.error('Error updating gateway (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/{sessionId}/gateways/[id]
 * Delete a gateway (session-scoped)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id: gatewayId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.user) {
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

    // Verify gateway belongs to current workspace
    const gateway = db
      .prepare('SELECT id FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, workspaceId)

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
    logger.error('Error deleting gateway (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
