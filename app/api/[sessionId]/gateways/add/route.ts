import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { GatewayClient } from '@/lib/gateway/client'
import logger from "@/lib/logger/index.js"

/**
 * POST /api/{sessionId}/gateways/add
 * Add a new gateway (session-scoped)
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

    const db = getDatabase()
    db.prepare(
      `INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'disconnected', ?, ?)`
    ).run(
      gatewayId,
      workspaceId,
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
    logger.error('Error adding gateway (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
