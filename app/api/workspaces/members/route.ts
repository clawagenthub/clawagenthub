import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import logger, { logCategories } from '@/lib/logger/index.js'


export async function GET(request: Request) {
  logger.debug('[API /api/workspaces/members] Starting request')
  
  try {
    const db = getDatabase()

    // Use global auth utility - replaces manual cookie parsing
    const auth = await getUserWithWorkspace()
    
    if (!auth) {
      logger.debug('[API /api/workspaces/members] No valid session or workspace')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }
    
    logger.debug('[API /api/workspaces/members] Authenticated:', {
      userId: auth.user.id,
      workspaceId: auth.workspaceId
    })

    // Get all members for the current workspace
    const members = db
      .prepare(`
        SELECT 
          wm.id,
          wm.workspace_id,
          wm.user_id,
          wm.role,
          wm.joined_at,
          u.email,
          u.is_superuser
        FROM workspace_members wm
        INNER JOIN users u ON wm.user_id = u.id
        WHERE wm.workspace_id = ?
        ORDER BY wm.joined_at ASC
      `)
      .all(auth.workspaceId)

    logger.debug('[API /api/workspaces/members] Found members:', {
      count: members.length
    })
    
    return NextResponse.json({ members })
  } catch (error) {
    logger.error('[API /api/workspaces/members] Fatal error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to fetch workspace members' },
      { status: 500 }
    )
  }
}
