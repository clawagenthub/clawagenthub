import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { staleTicketService } from '@/lib/services/stale-ticket.service'
import { getDatabase } from '@/lib/db/index.js'
import logger from '@/lib/logger/index.js'

/**
 * POST /api/cron/stale-check
 * 
 * Cron endpoint to check and transition stale tickets.
 * This endpoint is called by OpenClaw's cron scheduler every minute.
 * 
 * Request body options:
 * 1. With workspaceId: { workspaceId: "uuid" } - Check specific workspace
 * 2. Empty body: Check all workspaces with stale cron enabled
 * 
 * For OpenClaw cron integration, this runs in an isolated session.
 * The cron job is created via: openclaw cron add --every 1m --session isolated
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDatabase()

    // Parse request body
    let body: { workspaceId?: string; gatewayToken?: string } = {}
    try {
      body = await request.json().catch(() => ({}))
    } catch {
      // Empty body is OK
    }

    const { workspaceId } = body

    logger.info('[Cron/StaleCheck] Starting stale ticket check', { workspaceId })

    // If workspaceId provided, check only that workspace
    if (workspaceId) {
      const result = await staleTicketService.checkAndTransitionStaleTickets(workspaceId)
      
      return NextResponse.json({
        success: result.success,
        processedTickets: result.processedTickets,
        transitionedTickets: result.transitionedTickets,
        errors: result.errors,
        details: result.details,
        workspaceId
      })
    }

    // Otherwise, check all workspaces with stale cron enabled
    const workspaceIds = await staleTicketService.getWorkspacesWithStaleCronEnabled()
    
    logger.info(`[Cron/StaleCheck] Found ${workspaceIds.length} workspaces with stale cron enabled`)

    const allResults = {
      success: true,
      workspacesChecked: workspaceIds.length,
      totalProcessed: 0,
      totalTransitioned: 0,
      errors: [] as string[],
      results: [] as Array<{
        workspaceId: string
        processedTickets: number
        transitionedTickets: number
        success: boolean
      }>
    }

    for (const wsId of workspaceIds) {
      try {
        const result = await staleTicketService.checkAndTransitionStaleTickets(wsId)
        allResults.totalProcessed += result.processedTickets
        allResults.totalTransitioned += result.transitionedTickets
        allResults.results.push({
          workspaceId: wsId,
          processedTickets: result.processedTickets,
          transitionedTickets: result.transitionedTickets,
          success: result.success
        })
        if (!result.success) {
          allResults.success = false
        }
        allResults.errors.push(...result.errors.map(e => `Workspace ${wsId}: ${e}`))
      } catch (error) {
        allResults.errors.push(`Workspace ${wsId}: ${String(error)}`)
        allResults.success = false
      }
    }

    logger.info(`[Cron/StaleCheck] Completed: ${allResults.totalTransitioned}/${allResults.totalProcessed} tickets transitioned across ${workspaceIds.length} workspaces`)

    return NextResponse.json(allResults)
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
 * GET /api/cron/stale-check
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
