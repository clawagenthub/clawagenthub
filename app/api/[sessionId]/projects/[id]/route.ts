import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; id: string }>
}

/**
 * GET /api/{sessionId}/projects/[id]
 * Get a single project (session-scoped)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json({ message: 'No workspace selected' }, { status: 400 })
    }

    const project = db
      .prepare('SELECT * FROM workspace_projects WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId)

    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    logger.error('Error fetching project (session-scoped):', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/{sessionId}/projects/[id]
 * Update a project (session-scoped)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json({ message: 'No workspace selected' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, value } = body

    // Verify project exists
    const existing = db
      .prepare('SELECT * FROM workspace_projects WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId)

    if (!existing) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: any[] = []

    if (name !== undefined) {
      // Check for duplicate name
      const duplicate = db
        .prepare('SELECT id FROM workspace_projects WHERE workspace_id = ? AND LOWER(name) = LOWER(?) AND id != ?')
        .get(workspaceId, name.trim(), id)
      if (duplicate) {
        return NextResponse.json({ message: 'A project with this name already exists' }, { status: 409 })
      }
      updates.push('name = ?')
      values.push(name.trim())
    }

    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description?.trim() || null)
    }

    if (value !== undefined) {
      updates.push('value = ?')
      values.push(value?.trim() || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 })
    }

    values.push(id)
    values.push(workspaceId)

    db.prepare(`
      UPDATE workspace_projects SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?
    `).run(...values)

    const updated = db
      .prepare('SELECT * FROM workspace_projects WHERE id = ?')
      .get(id)

    return NextResponse.json({ project: updated })
  } catch (error) {
    logger.error('Error updating project (session-scoped):', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/{sessionId}/projects/[id]
 * Delete a project (session-scoped)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, id } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    await ensureDatabase()
    const db = getDatabase()

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json({ message: 'No workspace selected' }, { status: 400 })
    }

    const result = db
      .prepare('DELETE FROM workspace_projects WHERE id = ? AND workspace_id = ?')
      .run(id, workspaceId)

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting project (session-scoped):', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
