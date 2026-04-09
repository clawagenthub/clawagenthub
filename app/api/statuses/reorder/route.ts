import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import logger from "@/lib/logger/index.js"


interface ReorderItem {
  id: string
  priority: number
}

export async function POST(request: NextRequest) {
  logger.debug('[API /api/statuses/reorder] Starting request')

  try {
    const db = getDatabase()

    // Use global auth utility - replaces manual cookie parsing
    const auth = await getUserWithWorkspace()

    if (!auth) {
      logger.debug('[API /api/statuses/reorder] No valid session or workspace')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    logger.debug('[API /api/statuses/reorder] Authenticated:', {
      userId: auth.user.id,
      workspaceId: auth.workspaceId
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

    logger.debug('[API /api/statuses/reorder] Reordering statuses:', {
      count: items.length,
      items
    })

    // Update all statuses in a single transaction
    const updateStmt = db.prepare(`
      UPDATE statuses
      SET priority = ?
      WHERE id = ? AND workspace_id = ?
    `)

    const updateMany = db.transaction((items: ReorderItem[]) => {
      for (const item of items) {
        updateStmt.run(item.priority, item.id, auth.workspaceId)
      }
    })

    updateMany(items)

    logger.debug('[API /api/statuses/reorder] Successfully reordered statuses')

    // Fetch and return updated statuses
    const updatedStatuses = db
      .prepare(`
        SELECT * FROM statuses
        WHERE workspace_id = ?
        ORDER BY priority ASC, created_at ASC
      `)
      .all(auth.workspaceId)

    return NextResponse.json({ statuses: updatedStatuses })
  } catch (error) {
    logger.error('[API /api/statuses/reorder] Fatal error:', {
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
