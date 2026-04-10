import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * GET /api/{sessionId}/statuses/[id]/skills
 * Get skills associated with a status (session-scoped)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

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

    // Verify status exists and belongs to workspace
    const status = db
      .prepare('SELECT id FROM statuses WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId)

    if (!status) {
      return NextResponse.json(
        { message: 'Status not found' },
        { status: 404 }
      )
    }

    // Get skills associated with this status
    const skills = db
      .prepare(`
        SELECT s.*, ss.created_at as associated_at
        FROM skills s
        JOIN status_skills ss ON s.id = ss.skill_id
        WHERE ss.status_id = ?
          AND s.workspace_id = ?
          AND s.is_active = 1
        ORDER BY s.skill_name
      `)
      .all(id, workspaceId) as any[]

    return NextResponse.json({ skills })
  } catch (error) {
    logger.error('Error fetching status skills (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/{sessionId}/statuses/[id]/skills
 * Update skills associated with a status (session-scoped)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

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

    // Verify status exists
    const status = db
      .prepare('SELECT id FROM statuses WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId)

    if (!status) {
      return NextResponse.json(
        { message: 'Status not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { skill_ids } = body

    if (!Array.isArray(skill_ids)) {
      return NextResponse.json(
        { message: 'skill_ids must be an array' },
        { status: 400 }
      )
    }

    // Delete existing associations
    db.prepare('DELETE FROM status_skills WHERE status_id = ?').run(id)

    // Insert new associations
    for (const skillId of skill_ids) {
      // Verify skill exists and belongs to workspace
      const skill = db
        .prepare('SELECT id FROM skills WHERE id = ? AND workspace_id = ?')
        .get(skillId, workspaceId)

      if (skill) {
        db.prepare(`
          INSERT INTO status_skills (status_id, skill_id, created_at)
          VALUES (?, ?, ?)
        `).run(id, skillId, new Date().toISOString())
      }
    }

    // Get updated associations
    const skills = db
      .prepare(`
        SELECT s.*, ss.created_at as associated_at
        FROM skills s
        JOIN status_skills ss ON s.id = ss.skill_id
        WHERE ss.status_id = ?
          AND s.workspace_id = ?
        ORDER BY s.skill_name
      `)
      .all(id, workspaceId) as any[]

    return NextResponse.json({ skills })
  } catch (error) {
    logger.error('Error updating status skills (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
