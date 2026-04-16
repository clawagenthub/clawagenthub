import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import type { Identity } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

const IDENTITY_SESSION_DURATION_MS = parseInt(
  process.env.IDENTITY_SESSION_DURATION || '7200000',
  10
)

type RouteParams = { params: Promise<{ sessionId: string; id: string }> }

/**
 * POST /api/{sessionId}/identities/[id]/switch
 * Switch active identity (sets session context to identity)
 * The identity must belong to the current workspace.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Verify identity exists in this workspace
    const identity = db.prepare(
      `SELECT * FROM identities WHERE id = ? AND workspace_id = ?`
    ).get(identityId, workspaceId) as Identity | undefined

    if (!identity) {
      return NextResponse.json({ message: 'Identity not found in this workspace' }, { status: 404 })
    }

    if (!identity.is_active) {
      return NextResponse.json({ message: 'Cannot switch to inactive identity' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + IDENTITY_SESSION_DURATION_MS).toISOString()
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent')

    db.prepare('DELETE FROM identity_sessions WHERE session_token = ?').run(sessionId)

    db.prepare(
      `INSERT INTO identity_sessions (
        id, identity_id, session_token, ip_address, user_agent,
        expires_at, last_active_at, metadata, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      generateUserId(),
      identityId,
      sessionId,
      ipAddress,
      userAgent,
      expiresAt,
      now,
      JSON.stringify({ workspace_id: workspaceId, user_id: verification.user.id }),
      now,
      now
    )

    db.prepare(
      `UPDATE sessions SET current_identity_id = ? WHERE token = ?`
    ).run(identityId, sessionId)

    logger.info('[Identity Switch] Switched to identity:', { identityId, workspaceId, userId: verification.user.id })

    const response = NextResponse.json({
      success: true,
      active_identity_id: identityId,
      identity: {
        id: identity.id,
        name: identity.name,
        email: identity.email,
        identity_type: identity.identity_type,
        avatar_url: identity.avatar_url,
        is_active: identity.is_active,
      }
    })
    response.headers.set('X-Identity-ID', identityId)
    return response
  } catch (error) {
    logger.error('Error switching identity:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}