import { NextRequest } from 'next/server'
import { processFlowPost } from '@/app/api/tickets/[ticketId]/flow/lib/process-post'

interface RouteParams {
  params: Promise<{ ticketId_sessionToken: string }>
}

/**
 * POST /api/tickets/[ticketId]_[sessionToken]/pause
 * Agent callback to pause flow (session token in URL path)
 */
export async function POST(request: NextRequest, context: RouteParams) {
  const { ticketId_sessionToken } = await context.params
  const [ticketId, sessionToken] = ticketId_sessionToken.split('_', 2)
  return processFlowPost(request, { params: Promise.resolve({ ticketId }) }, 'pause', sessionToken)
}