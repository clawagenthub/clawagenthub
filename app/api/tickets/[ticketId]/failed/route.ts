    import { NextRequest } from 'next/server'
import { processFlowPost } from '@/app/api/tickets/[ticketId]/flow/route'

interface RouteParams {
  params: Promise<{ ticketId: string }>
}

/**
 * POST /api/tickets/[ticketId]/failed
 * Alias for POST /api/tickets/[ticketId]/flow with result=failed
 */
export async function POST(request: NextRequest, context: RouteParams) {
  return processFlowPost(request, context, 'failed')
}

