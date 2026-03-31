import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'

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
    const { name, url, authToken } = body

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { message: 'Gateway name is required' },
        { status: 400 }
      )
    }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json(
        { message: 'Gateway URL is required' },
        { status: 400 }
      )
    }

    // Validate auth token is required
    if (!authToken || typeof authToken !== 'string' || authToken.trim().length === 0) {
      return NextResponse.json(
        { message: 'Gateway auth token is required' },
        { status: 400 }
      )
    }

    // Basic URL validation
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { message: 'Invalid gateway URL format' },
        { status: 400 }
      )
    }

    // Check if URL starts with ws:// or wss://
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      return NextResponse.json(
        { message: 'Gateway URL must start with ws:// or wss://' },
        { status: 400 }
      )
    }

    // Create gateway
    const gatewayId = nanoid()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'disconnected', ?, ?)`
    ).run(
      gatewayId,
      session.current_workspace_id,
      name.trim(),
      url.trim(),
      authToken.trim(),
      now,
      now
    )

    // Fetch the created gateway
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE id = ?')
      .get(gatewayId)

    return NextResponse.json({ gateway }, { status: 201 })
  } catch (error) {
    console.error('Error adding gateway:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
