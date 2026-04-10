import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { generateUserId } from '@/lib/auth/token.js'
import { getDatabase } from '@/lib/db/index.js'
import type { TicketFlowConfig } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; ticketId: string }>
}

/**
 * GET /api/{sessionId}/tickets/{ticketId}/flow-config
 * Get flow configuration for a ticket (session-scoped)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, ticketId } = await params

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

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Verify ticket belongs to workspace
    const ticket = db.prepare(
      'SELECT id FROM tickets WHERE id = ? AND workspace_id = ?'
    ).get(ticketId, workspaceId)

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    const flowConfigs = db.prepare(`
      SELECT tfc.*, s.name as status_name, s.color as status_color
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ?
      ORDER BY tfc.flow_order ASC
    `).all(ticketId) as (TicketFlowConfig & {
      status_name: string
      status_color: string
    })[]

    return NextResponse.json({
      flow_configs: flowConfigs.map(fc => ({
        id: fc.id,
        status_id: fc.status_id,
        status: {
          id: fc.status_id,
          name: fc.status_name,
          color: fc.status_color
        },
        flow_order: fc.flow_order,
        agent_id: fc.agent_id,
        on_failed_goto: fc.on_failed_goto,
        ask_approve_to_continue: fc.ask_approve_to_continue,
        instructions_override: fc.instructions_override,
        is_included: fc.is_included
      }))
    })
  } catch (error) {
    logger.error('Error fetching flow config (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/{sessionId}/tickets/{ticketId}/flow-config
 * Initialize flow configuration for a ticket (session-scoped)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, ticketId } = await params

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

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = db.prepare(
      'SELECT id FROM tickets WHERE id = ? AND workspace_id = ?'
    ).get(ticketId, workspaceId)

    if (!ticket) {
      return NextResponse.json(
        { message: 'Ticket not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { flow_configs } = body

    if (!flow_configs || !Array.isArray(flow_configs)) {
      return NextResponse.json(
        { message: 'flow_configs array is required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Delete existing configs
    db.prepare('DELETE FROM ticket_flow_configs WHERE ticket_id = ?').run(ticketId)

    // Insert new configs
    for (const config of flow_configs) {
      const configId = generateUserId()
      db.prepare(`
        INSERT INTO ticket_flow_configs (
          id, ticket_id, status_id, flow_order, agent_id, on_failed_goto,
          ask_approve_to_continue, instructions_override, is_included, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        configId,
        ticketId,
        config.status_id,
        config.flow_order,
        config.agent_id || null,
        config.on_failed_goto || null,
        config.ask_approve_to_continue ? 1 : 0,
        config.instructions_override || null,
        config.is_included !== false ? 1 : 0,
        now,
        now
      )
    }

    // Return updated configs
    const updatedConfigs = db.prepare(`
      SELECT tfc.*, s.name as status_name, s.color as status_color
      FROM ticket_flow_configs tfc
      LEFT JOIN statuses s ON tfc.status_id = s.id
      WHERE tfc.ticket_id = ?
      ORDER BY tfc.flow_order ASC
    `).all(ticketId) as (TicketFlowConfig & {
      status_name: string
      status_color: string
    })[]

    return NextResponse.json({
      flow_configs: updatedConfigs.map(fc => ({
        id: fc.id,
        status_id: fc.status_id,
        status: {
          id: fc.status_id,
          name: fc.status_name,
          color: fc.status_color
        },
        flow_order: fc.flow_order,
        agent_id: fc.agent_id,
        on_failed_goto: fc.on_failed_goto,
        ask_approve_to_continue: fc.ask_approve_to_continue,
        instructions_override: fc.instructions_override,
        is_included: fc.is_included
      }))
    }, { status: 201 })
  } catch (error) {
    logger.error('Error initializing flow config (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
