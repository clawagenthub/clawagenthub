import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import logger from "@/lib/logger/index.js"

interface ReorderItem {
  id: string
  priority: number
}

/**
 * POST /api/{sessionId}/statuses/reorder
 * Reorder statuses within a workspace (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  logger.debug('[API /api/{sessionId}/statuses/reorder] Starting request')

  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid) {
      logger.debug('[API /api/{sessionId}/statuses/reorder] No valid session')
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

    logger.debug('[API /api/{sessionId}/statuses/reorder] Authenticated:', {
      userId: verification.userId,
      workspaceId
    })

    const body = await request.json()
    const { items } = body as { items: ReorderItem[] }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required' },
        { status: 400 }
      )
    }

    // Validate each item has id and priority
    for (const item of items) {
      if (!item.id || typeof item.priority !== 'number') {
        return NextResponse.json(
          { error: 'Each item must have id (string) and priority (number)' },
          { status: 400 }
        )
      }
    }

    logger.debug('[API /api/{sessionId}/statuses/reorder] Reordering statuses:', {
      count: items.length,
      items
    })

    const db = getDatabase()

    // Update all statuses in a single transaction
    const updateStmt = db.prepare(`
      UPDATE statuses
      SET priority = ?
      WHERE id = ? AND workspace_id = ?
    `)

    const updateMany = db.transaction((items: ReorderItem[]) => {
      for (const item of items) {
        updateStmt.run(item.priority, item.id, workspaceId)
      }
    })

    updateMany(items)

    logger.debug('[API /api/{sessionId}/statuses/reorder] Successfully reordered statuses')

    // Fetch and return updated statuses
    const updatedStatuses = db
      .prepare(`
        SELECT * FROM statuses
        WHERE workspace_id = ?
        ORDER BY priority ASC, created_at ASC
      `)
      .all(workspaceId)

    return NextResponse.json({ statuses: updatedStatuses })
  } catch (error) {
    logger.error('[API /api/{sessionId}/statuses/reorder] Fatal error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to reorder statuses' },
      { status: 500 }
    )
  }
}
