import { NextRequest } from 'next/server'
import { processFlowPost } from '@/app/api/tickets/[ticketId]/flow/route'

interface RouteParams {
  params: Promise<{ ticketId_sessionToken: string }>
}

/**
 * POST /api/tickets/[ticketId]_[sessionToken]/finished
 * Agent callback to mark flow step as finished (session token in URL path)
 */
export async function POST(request: NextRequest, context: RouteParams) {
  const { ticketId_sessionToken } = await context.params
  const [ticketId, sessionToken] = ticketId_sessionToken.split('_', 2)
  return processFlowPost(request, { params: Promise.resolve({ ticketId }) }, 'finished', sessionToken)
}