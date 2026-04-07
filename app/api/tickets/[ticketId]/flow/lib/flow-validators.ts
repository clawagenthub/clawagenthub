import { NextRequest, NextResponse } from 'next/server'
import type { FlowPostBody } from './flow-types.js'

/**
 * Validate session token and return user or error response
 */
export function validateSessionToken(request: NextRequest, sessionToken?: string): { user: unknown; sessionToken: string } | { error: NextResponse; sessionToken: null } {
  // This is a placeholder - actual implementation needs access to cookies/session
  // The actual validation happens in route.ts before calling validators
  return {
    error: NextResponse.json({ message: 'Unauthorized - No session found' }, { status: 401 }),
    sessionToken: null
  }
}

/**
 * Validate flow POST action
 */
export function validateFlowAction(body: FlowPostBody): { valid: true } | { valid: false; response: NextResponse } {
  const { action, result } = body

  if (action && action !== 'start' && action !== 'stop' && action !== 'pause') {
    return {
      valid: false,
      response: NextResponse.json(
        { message: 'Invalid action. Must be "start", "stop", or "pause"' },
        { status: 400 }
      )
    }
  }

  if (!action && result !== 'finished' && result !== 'failed' && result !== 'pause') {
    return {
      valid: false,
      response: NextResponse.json(
        { message: 'Invalid payload. Provide action=start|stop|pause or result=finished|failed|pause' },
        { status: 400 }
      )
    }
  }

  return { valid: true }
}

/**
 * Check if flow is enabled for ticket
 */
export function validateFlowEnabled(ticket: { flow_enabled: number }): { valid: true } | { valid: false; response: NextResponse } {
  if (!ticket.flow_enabled) {
    return {
      valid: false,
      response: NextResponse.json(
        { message: 'Flow is not enabled for this ticket' },
        { status: 400 }
      )
    }
  }
  return { valid: true }
}

/**
 * Validate workspace session
 */
export function validateWorkspaceSession(session: { current_workspace_id: string | null } | undefined): { valid: true; workspaceId: string } | { valid: false; response: NextResponse } {
  if (!session?.current_workspace_id) {
    return {
      valid: false,
      response: NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }
  }
  return { valid: true, workspaceId: session.current_workspace_id }
}

/**
 * Validate ticket exists
 */
export function validateTicket(ticket: unknown): { valid: true; ticket: unknown } | { valid: false; response: NextResponse } {
  if (!ticket) {
    return {
      valid: false,
      response: NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }
  }
  return { valid: true, ticket }
}
