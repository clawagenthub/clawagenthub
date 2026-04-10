import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { generateUserId } from '@/lib/auth/token.js'
import { getDatabase } from '@/lib/db/index.js'
import type { TicketComment } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; ticketId: string }>
}

/**
 * GET /api/{sessionId}/tickets/{ticketId}/comments
 * Get all comments for a ticket (session-scoped)
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

    const comments = db.prepare(`
      SELECT tc.*, u.email as author_email
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.ticket_id = ?
      ORDER BY tc.created_at ASC
    `).all(ticketId) as (TicketComment & { author_email: string })[]

    return NextResponse.json({
      comments: comments.map(comment => ({
        ...comment,
        author: {
          id: comment.user_id,
          email: comment.author_email
        }
      }))
    })
  } catch (error) {
    logger.error('Error fetching comments (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/{sessionId}/tickets/{ticketId}/comments
 * Create a new comment on a ticket (session-scoped)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, ticketId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
      workspaceId: sessionId
    })

    if (!verification.valid || !verification.user) {
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

    const body = await request.json()
    const { content, is_agent_completion_signal } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { message: 'Comment content is required' },
        { status: 400 }
      )
    }

    const commentId = generateUserId()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO ticket_comments (id, ticket_id, user_id, content, is_agent_completion_signal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      commentId,
      ticketId,
      verification.user.id,
      content.trim(),
      is_agent_completion_signal ? 1 : 0,
      now,
      now
    )

    const comment = db.prepare(`
      SELECT tc.*, u.email as author_email
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.id = ?
    `).get(commentId) as TicketComment & { author_email: string }

    return NextResponse.json({
      comment: {
        ...comment,
        author: {
          id: comment.user_id,
          email: comment.author_email
        }
      }
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating comment (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
