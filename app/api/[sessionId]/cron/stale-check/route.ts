import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { staleTicketService } from '@/lib/services/stale-ticket.service'
import logger from '@/lib/logger/index.js'

/**
 * POST /api/{sessionId}/cron/stale-check
 * 
 * Cron endpoint to check and transition stale tickets (session-scoped).
 * This endpoint is called by OpenClaw's cron scheduler.
 * 
 * Request body options:
 * 1. With workspaceId: { workspaceId: "uuid" } - Check specific workspace
 * 2. Empty body: Check workspace from session
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    await ensureDatabase()

    const { sessionId } = await params

    // Parse request body
    let body: { workspaceId?: string } = {}
    try {
      body = await request.json().catch(() => ({}))
    } catch {
      // Empty body is OK
    }

    const { workspaceId } = body

    logger.info('[Cron/StaleCheck] Starting stale ticket check', { 
      sessionId,
      workspaceId: workspaceId || 'from-session' 
    })

    // Use workspace from session if not provided
    const targetWorkspaceId = workspaceId || sessionId

    const result = await staleTicketService.checkAndTransitionStaleTickets(targetWorkspaceId)
    
    return NextResponse.json({
      success: result.success,
      processedTickets: result.processedTickets,
      transitionedTickets: result.transitionedTickets,
      errors: result.errors,
      details: result.details,
      workspaceId: targetWorkspaceId
    })
  } catch (error) {
    logger.error('[Cron/StaleCheck] Critical error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: String(error),
        message: 'Internal server error in stale check cron'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/{sessionId}/cron/stale-check
 * 
 * Health check endpoint for the cron
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'stale-ticket-cron',
    timestamp: new Date().toISOString()
  })
}
