import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import { GatewayClient } from '@/lib/gateway/client'
import type { Gateway } from '@/lib/db/schema'

// GET /api/gateways - List all gateways for the current workspace
export async function GET(request: Request) {
  console.log('[GET /api/gateways] Starting request')
  
  try {
    const auth = await getUserWithWorkspace()
    if (!auth) {
      console.log('[GET /api/gateways] No valid session or workspace')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }
    
    console.log('[GET /api/gateways] Authenticated:', {
      userId: auth.user.id,
      workspaceId: auth.workspaceId
    })
    
    const db = getDatabase()

    const gateways = db
      .prepare(
        `SELECT id, name, url, status, last_connected_at, last_error, created_at, updated_at
         FROM gateways
         WHERE workspace_id = ?
         ORDER BY created_at DESC`
      )
      .all(auth.workspaceId) as Omit<Gateway, 'auth_token' | 'workspace_id'>[]

    console.log('[GET /api/gateways] Found gateways:', {
      count: gateways.length,
      gateways: gateways.map(g => ({ id: g.id, name: g.name, status: g.status }))
    })

    return NextResponse.json({ gateways })
  } catch (error) {
    console.error('[GET /api/gateways] Error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch gateways' },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

// POST /api/gateways - Add a new gateway
export async function POST(request: Request) {
  console.log('[POST /api/gateways] Starting request')
  
  try {
    const auth = await getUserWithWorkspace()
    if (!auth) {
      console.log('[POST /api/gateways] No valid session or workspace')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }
    
    console.log('[POST /api/gateways] Authenticated:', {
      userId: auth.user.id,
      workspaceId: auth.workspaceId
    })
    
    const body = await request.json()
    const { name, url, authToken } = body

    console.log('[POST /api/gateways] Request body:', {
      name,
      url,
      hasAuthToken: !!authToken,
      authTokenLength: authToken?.length
    })

    // Validate inputs
    if (!name || typeof name !== 'string') {
      console.log('[POST /api/gateways] Validation failed: name missing')
      return NextResponse.json({ error: 'Gateway name is required' }, { status: 400 })
    }

    if (!url || typeof url !== 'string') {
      console.log('[POST /api/gateways] Validation failed: url missing')
      return NextResponse.json({ error: 'Gateway URL is required' }, { status: 400 })
    }

    if (!authToken || typeof authToken !== 'string') {
      console.log('[POST /api/gateways] Validation failed: authToken missing')
      return NextResponse.json({ error: 'Auth token is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url)
      if (!['ws:', 'wss:'].includes(parsedUrl.protocol)) {
        console.log('[POST /api/gateways] Validation failed: invalid protocol', parsedUrl.protocol)
        return NextResponse.json(
          { error: 'Gateway URL must use ws:// or wss:// protocol' },
          { status: 400 }
        )
      }
      console.log('[POST /api/gateways] URL validation passed:', {
        protocol: parsedUrl.protocol,
        host: parsedUrl.host
      })
    } catch (urlError) {
      console.error('[POST /api/gateways] URL parsing failed:', urlError)
      return NextResponse.json({ error: 'Invalid gateway URL format' }, { status: 400 })
    }

    // Test connection to gateway
    console.log(`[POST /api/gateways] Testing connection to ${url}`)
    const origin = request.headers.get('origin') || 'http://localhost:3000'
    console.log(`[POST /api/gateways] Using origin: ${origin}`)
    
    const client = new GatewayClient(url, { authToken, origin })

    try {
      console.log('[POST /api/gateways] Attempting WebSocket connection...')
      await client.connect()
      console.log(`[POST /api/gateways] Connected successfully`)

      // Test health endpoint
      console.log('[POST /api/gateways] Calling health() RPC method...')
      const health = await client.health()
      console.log(`[POST /api/gateways] Health check response:`, health)

      await client.disconnect()
      console.log('[POST /api/gateways] Disconnected cleanly')
    } catch (error) {
      console.error(`[POST /api/gateways] Connection test failed:`, {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return NextResponse.json(
        {
          error: 'Failed to connect to gateway',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      )
    }

    // Save to database
    const db = getDatabase()
    const gatewayId = crypto.randomUUID()

    db.prepare(
      `INSERT INTO gateways (id, workspace_id, name, url, auth_token, status, last_connected_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'connected', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(gatewayId, auth.workspaceId, name, url, authToken)

    console.log(`[POST /api/gateways] Gateway ${gatewayId} saved successfully`)

    const gateway = db
      .prepare('SELECT id, name, url, status, last_connected_at FROM gateways WHERE id = ?')
      .get(gatewayId) as Omit<Gateway, 'auth_token' | 'workspace_id'>

    return NextResponse.json({ gateway }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/gateways] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add gateway' },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}

// DELETE /api/gateways/:id - Remove a gateway
export async function DELETE(request: Request) {
  try {
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }
    const url = new URL(request.url)
    const gatewayId = url.searchParams.get('id')

    if (!gatewayId) {
      return NextResponse.json({ error: 'Gateway ID is required' }, { status: 400 })
    }

    const db = getDatabase()

    // Verify gateway belongs to workspace
    const gateway = db
      .prepare('SELECT id FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, auth.workspaceId)

    if (!gateway) {
      return NextResponse.json({ error: 'Gateway not found' }, { status: 404 })
    }

    // Delete gateway
    db.prepare('DELETE FROM gateways WHERE id = ?').run(gatewayId)

    console.log(`[DELETE /api/gateways] Gateway ${gatewayId} deleted`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/gateways] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete gateway' },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
