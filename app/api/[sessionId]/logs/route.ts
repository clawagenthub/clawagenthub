import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/logs
 * Get audit logs for the current workspace (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
      workspaceId: sessionId
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

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticketId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const db = getDatabase()

    let logs: unknown[]
    let total: number

    if (ticketId) {
      // Get logs for specific ticket
      logs = db
        .prepare(`
          SELECT * FROM ticket_audit_logs
          WHERE ticket_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `)
        .all(ticketId, limit, offset)

      const countResult = db
        .prepare('SELECT COUNT(*) as count FROM ticket_audit_logs WHERE ticket_id = ?')
        .get(ticketId) as { count: number }
      total = countResult.count
    } else {
      // Get all logs for workspace (ticket audit logs don't have workspace_id directly,
      // so we join with tickets to filter by workspace)
      logs = db
        .prepare(`
          SELECT tal.* FROM ticket_audit_logs tal
          JOIN tickets t ON tal.ticket_id = t.id
          WHERE t.workspace_id = ?
          ORDER BY tal.created_at DESC
          LIMIT ? OFFSET ?
        `)
        .all(workspaceId, limit, offset)

      const countResult = db
        .prepare(`
          SELECT COUNT(*) as count FROM ticket_audit_logs tal
          JOIN tickets t ON tal.ticket_id = t.id
          WHERE t.workspace_id = ?
        `)
        .get(workspaceId) as { count: number }
      total = countResult.count
    }

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total
      }
    })
  } catch (error) {
    logger.error('[Logs API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}
