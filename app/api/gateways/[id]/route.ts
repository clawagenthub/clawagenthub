import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager.js'

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
    console.error('Error deleting gateway:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
