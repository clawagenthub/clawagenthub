/**
 * Drafts API Routes
 * CRUD operations for LinkedIn post drafts
 * 
 * Endpoints:
 * - GET    /api/{sessionId}/drafts          - List all drafts
 * - POST   /api/{sessionId}/drafts          - Create draft
 * - GET    /api/{sessionId}/drafts/[id]     - Get single draft
 * - PUT    /api/{sessionId}/drafts/[id]     - Update draft
 * - DELETE /api/{sessionId}/drafts/[id]     - Delete draft
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/index.js'
import { verifySession } from '@/lib/session/verify'
import type { Draft, DraftInsert } from '@/lib/db/schema.js'
import { randomUUID } from 'crypto'

/**
 * GET /api/{sessionId}/drafts
 * List all drafts for the current workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    const verification = verifySession({ sessionToken: sessionId })
    if (!verification.valid || !verification.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const db = getDatabase()
    const session = db.prepare(
      'SELECT current_workspace_id FROM sessions WHERE token = ?'
    ).get(sessionId) as { current_workspace_id: string } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No active workspace' }, { status: 400 })
    }

    const workspaceId = session.current_workspace_id
    const identityId = request.headers.get('X-Identity-ID') || 
                       request.nextUrl.searchParams.get('identity_id')

    let query = 'SELECT * FROM drafts WHERE workspace_id = ?'
    const queryParams: string[] = [workspaceId]

    if (identityId) {
      query += ' AND identity_id = ?'
      queryParams.push(identityId)
    }

    query += ' ORDER BY updated_at DESC'

    const drafts = db.prepare(query).all(...queryParams) as Draft[]

    // Parse metadata JSON
    const parsed = drafts.map(d => ({
      ...d,
      metadata: d.metadata ? JSON.parse(d.metadata) : null
    }))

    return NextResponse.json({ drafts: parsed })
  } catch (error) {
    console.error('Drafts GET error:', error)
    return NextResponse.json({ message: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/{sessionId}/drafts
 * Create a new draft
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    const verification = verifySession({ sessionToken: sessionId })
    if (!verification.valid || !verification.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const db = getDatabase()
    const session = db.prepare(
      'SELECT current_workspace_id FROM sessions WHERE token = ?'
    ).get(sessionId) as { current_workspace_id: string } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No active workspace' }, { status: 400 })
    }

    const body = await request.json()
    const { identity_id, title, content, excerpt, scheduled_at, visibility, source_platform, metadata } = body

    if (!identity_id) {
      return NextResponse.json({ message: 'identity_id is required' }, { status: 400 })
    }

    const id = randomUUID()
    const now = new Date().toISOString()

    const draft: DraftInsert = {
      workspace_id: session.current_workspace_id,
      identity_id,
      title: title || null,
      content: content || null,
      excerpt: excerpt || null,
      scheduled_at: scheduled_at || null,
      visibility: visibility || 'public',
      source_platform: source_platform || null,
      metadata: metadata ? JSON.stringify(metadata) : null
    }

    db.prepare(`
      INSERT INTO drafts (id, workspace_id, identity_id, title, content, excerpt, 
                         scheduled_at, visibility, source_platform, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      draft.workspace_id,
      draft.identity_id,
      draft.title,
      draft.content,
      draft.excerpt,
      draft.scheduled_at,
      draft.visibility,
      draft.source_platform,
      draft.metadata,
      now,
      now
    )

    const created = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as Draft

    return NextResponse.json({ 
      draft: {
        ...created,
        metadata: created.metadata ? JSON.parse(created.metadata) : null
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Drafts POST error:', error)
    return NextResponse.json({ message: 'Internal error' }, { status: 500 })
  }
}