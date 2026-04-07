import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import type { TicketComment } from '@/lib/db/schema.js'

interface RouteParams {
  params: Promise<{ ticketId: string }>
}

/**
 * GET /api/tickets/[ticketId]/comments
 * Get all comments for a ticket
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { ticketId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    const db = getDatabase()

    // Get user's current workspace
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Verify ticket exists in workspace
    const ticket = db
      .prepare('SELECT id FROM tickets WHERE id = ? AND workspace_id = ?')
      .get(ticketId, session.current_workspace_id) as { id: string } | undefined

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    }

    // Get comments
    const comments = db
      .prepare(
        `
      SELECT tc.*, u.email as author_email
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.created_by = u.id
      WHERE tc.ticket_id = ?
      ORDER BY tc.created_at ASC
    `
      )
      .all(ticketId) as (TicketComment & {
      author_email: string
    })[]

    return NextResponse.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        created_by: {
          id: comment.created_by,
          email: comment.author_email,
        },
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        is_agent_completion_signal: comment.is_agent_completion_signal,
      })),
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tickets/[ticketId]/comments
 * Add a comment to a ticket
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { ticketId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { content, is_agent_completion_signal } = body

    // Validate content
    if (
      !content ||
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      return NextResponse.json(
        { message: 'Comment content is required' },
        { status: 400 }
      )
    }

    if (content.length > 100000) {
      return NextResponse.json(
        { message: 'Comment must be 10000 characters or less' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    // Get user's current workspace
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Verify ticket exists in workspace
    const ticket = db
      .prepare(
        'SELECT id, status_id FROM tickets WHERE id = ? AND workspace_id = ?'
      )
      .get(ticketId, session.current_workspace_id) as
      | { id: string; status_id: string }
      | undefined

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    }

    const commentId = generateUserId()
    const now = new Date().toISOString()

    // Create comment
    db.prepare(
      `INSERT INTO ticket_comments (
        id, ticket_id, content, created_by, is_agent_completion_signal, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      commentId,
      ticketId,
      content.trim(),
      user.id,
      is_agent_completion_signal ? 1 : 0,
      now,
      now
    )

    // Create audit log entry
    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticketId,
      'comment_added',
      user.id,
      'user',
      JSON.stringify({ comment_id: commentId, content: content.trim() }),
      now
    )

    // Get the created comment
    const comment = db
      .prepare(
        `
      SELECT tc.*, u.email as author_email
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.created_by = u.id
      WHERE tc.id = ?
    `
      )
      .get(commentId) as TicketComment & {
      author_email: string
    }

    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          content: comment.content,
          created_by: {
            id: comment.created_by,
            email: comment.author_email,
          },
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          is_agent_completion_signal: comment.is_agent_completion_signal,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
