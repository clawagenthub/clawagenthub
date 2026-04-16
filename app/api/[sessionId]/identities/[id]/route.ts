import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import type { Identity } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

type RouteParams = { params: Promise<{ sessionId: string; id: string }> }

/**
 * GET /api/{sessionId}/identities/[id]
 * Get a specific identity by ID (session-scoped, identity-scoped via X-Identity-ID header)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

    const verification = verifySession({ sessionToken: sessionId })
    if (!verification.valid || !verification.user) {
      return NextResponse.json({ message: verification.error || 'Unauthorized' }, { status: 401 })
    }

    await ensureDatabase()
    const db = getDatabase()

    const session = db.prepare('SELECT current_workspace_id FROM sessions WHERE token = ?').get(sessionId) as any
    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No active workspace' }, { status: 400 })
    }

    const workspaceId = session.current_workspace_id

    // Scope to identity_id from header or param
    const identityId = request.headers.get('X-Identity-ID') || id

    const activeIdentitySession = db.prepare(
      `SELECT expires_at, is_active FROM identity_sessions WHERE session_token = ? AND identity_id = ?`
    ).get(sessionId, identityId) as
      | { expires_at: string; is_active: number | boolean }
      | undefined

    if (
      activeIdentitySession &&
      (!activeIdentitySession.is_active ||
        new Date(activeIdentitySession.expires_at).getTime() <= Date.now())
    ) {
      db.prepare(
        `UPDATE sessions SET current_identity_id = NULL WHERE token = ? AND current_identity_id = ?`
      ).run(sessionId, identityId)
      db.prepare(
        `DELETE FROM identity_sessions WHERE session_token = ? AND identity_id = ?`
      ).run(sessionId, identityId)

      return NextResponse.json(
        { message: 'Identity session expired' },
        { status: 410 }
      )
    }

    const identity = db.prepare(
      `SELECT * FROM identities WHERE id = ? AND workspace_id = ?`
    ).get(identityId, workspaceId) as Identity | undefined

    if (!identity) {
      return NextResponse.json({ message: 'Identity not found' }, { status: 404 })
    }

    const sanitized = {
      id: identity.id,
      workspace_id: identity.workspace_id,
      identity_type: identity.identity_type,
      name: identity.name,
      email: identity.email,
      username: identity.username,
      avatar_url: identity.avatar_url,
      profile_data: identity.profile_data ? JSON.parse(identity.profile_data) : null,
      is_active: identity.is_active,
      created_at: identity.created_at,
      updated_at: identity.updated_at,
    }

    const response = NextResponse.json({ identity: sanitized })
    response.headers.set('X-Identity-ID', identityId)
    return response
  } catch (error) {
    logger.error('Error fetching identity:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/{sessionId}/identities/[id]
 * Update an identity (session-scoped, identity-scoped)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

    const verification = verifySession({ sessionToken: sessionId })
    if (!verification.valid || !verification.user) {
      return NextResponse.json({ message: verification.error || 'Unauthorized' }, { status: 401 })
    }

    await ensureDatabase()
    const db = getDatabase()

    const session = db.prepare('SELECT current_workspace_id FROM sessions WHERE token = ?').get(sessionId) as any
    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No active workspace' }, { status: 400 })
    }

    const workspaceId = session.current_workspace_id
    const identityId = request.headers.get('X-Identity-ID') || id

    const existing = db.prepare(
      `SELECT * FROM identities WHERE id = ? AND workspace_id = ?`
    ).get(identityId, workspaceId) as Identity | undefined

    if (!existing) {
      return NextResponse.json({ message: 'Identity not found' }, { status: 404 })
    }

    const body = await request.json()
    const allowedFields = ['name', 'identity_type', 'email', 'username', 'avatar_url', 'profile_data', 'is_active']
    const updates: string[] = []
    const values: any[] = []

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(field === 'profile_data' ? JSON.stringify(body[field]) : body[field])
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(identityId, workspaceId)

    db.prepare(`UPDATE identities SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM identities WHERE id = ?').get(identityId) as Identity

    logger.info('[Identity Update] Updated identity:', { identityId, workspaceId })

    const response = NextResponse.json({ identity: updated })
    response.headers.set('X-Identity-ID', identityId)
    return response
  } catch (error) {
    logger.error('Error updating identity:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/{sessionId}/identities/[id]
 * Delete an identity (session-scoped, identity-scoped)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

    const verification = verifySession({ sessionToken: sessionId })
    if (!verification.valid || !verification.user) {
      return NextResponse.json({ message: verification.error || 'Unauthorized' }, { status: 401 })
    }

    await ensureDatabase()
    const db = getDatabase()

    const session = db.prepare('SELECT current_workspace_id FROM sessions WHERE token = ?').get(sessionId) as any
    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No active workspace' }, { status: 400 })
    }

    const workspaceId = session.current_workspace_id
    const identityId = request.headers.get('X-Identity-ID') || id

    const existing = db.prepare(
      `SELECT * FROM identities WHERE id = ? AND workspace_id = ?`
    ).get(identityId, workspaceId) as Identity | undefined

    if (!existing) {
      return NextResponse.json({ message: 'Identity not found' }, { status: 404 })
    }

    // Delete related records first (api keys, sessions)
    db.prepare('DELETE FROM identity_api_keys WHERE identity_id = ?').run(identityId)
    db.prepare('DELETE FROM identity_sessions WHERE identity_id = ?').run(identityId)
    db.prepare('DELETE FROM identities WHERE id = ?').run(identityId)

    logger.info('[Identity Delete] Deleted identity:', { identityId, workspaceId })

    return NextResponse.json({ success: true, deleted: identityId })
  } catch (error) {
    logger.error('Error deleting identity:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}