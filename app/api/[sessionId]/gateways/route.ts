import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import { GatewayClient } from '@/lib/gateway/client'
import type { Gateway } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/gateways
 * List all gateways for the current workspace (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
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

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const gateways = db
      .prepare(
        `SELECT id, name, url, status, last_connected_at, last_error, created_at, updated_at
         FROM gateways
         WHERE workspace_id = ?
         ORDER BY created_at DESC`
      )
      .all(workspaceId) as Omit<Gateway, 'auth_token' | 'workspace_id'>[]

    return NextResponse.json({ gateways })
  } catch (error) {
    logger.error('Error fetching gateways (session-scoped):', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch gateways' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/{sessionId}/gateways
 * Add a new gateway (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
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

    await ensureDatabase()
    const db = getDatabase()

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
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Gateway name is required' }, { status: 400 })
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Gateway URL is required' }, { status: 400 })
    }

    if (!authToken || typeof authToken !== 'string') {
      return NextResponse.json({ error: 'Auth token is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url)
      if (!['ws:', 'wss:'].includes(parsedUrl.protocol)) {
        return NextResponse.json(
          { error: 'Gateway URL must use ws:// or wss:// protocol' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json({ error: 'Invalid gateway URL format' }, { status: 400 })
    }

    // Test connection
    const origin = request.headers.get('origin') || 'http://localhost:3000'
    const client = new GatewayClient(url, { authToken, origin })

    try {
      await client.connect()
      const health = await client.health()
      await client.disconnect()
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to connect to gateway',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      )
    }

    // Save to database
    const gatewayId = crypto.randomUUID()

    db.prepare(
      `INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, last_connected_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'connected', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(gatewayId, workspaceId, name, url, authToken)

    const gateway = db
      .prepare('SELECT id, name, url, status, last_connected_at FROM gateways WHERE id = ?')
      .get(gatewayId) as Omit<Gateway, 'auth_token' | 'workspace_id'>

    return NextResponse.json({ gateway }, { status: 201 })
  } catch (error) {
    logger.error('Error adding gateway (session-scoped):', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add gateway' },
      { status: 500 }
    )
  }
}
