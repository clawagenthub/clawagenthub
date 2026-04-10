import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/chat/sessions/idle-check
 * Check for idle chat sessions (session-scoped)
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

    const { searchParams } = new URL(request.url)
    const idleThresholdMinutes = parseInt(searchParams.get('idle_threshold_minutes') || '30')

    // Find sessions that haven't had activity within the threshold
    const idleSessions = db.prepare(`
      SELECT cs.*, u.email as user_email
      FROM chat_sessions cs
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE cs.workspace_id = ?
        AND cs.status = 'active'
        AND datetime(cs.last_activity_at) < datetime('now', ?)
      ORDER BY cs.last_activity_at ASC
    `).all(workspaceId, `-${idleThresholdMinutes} minutes`) as any[]

    return NextResponse.json({
      idle_sessions: idleSessions.map(session => ({
        id: session.id,
        agent_name: session.agent_name,
        user_email: session.user_email,
        last_activity_at: session.last_activity_at,
        status: session.status
      })),
      idle_threshold_minutes: idleThresholdMinutes
    })
  } catch (error) {
    logger.error('[Chat API] Error checking idle sessions (session-scoped):', error)
    return NextResponse.json(
      { error: 'Failed to check idle sessions' },
      { status: 500 }
    )
  }
}
