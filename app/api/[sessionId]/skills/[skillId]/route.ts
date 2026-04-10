import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import logger from "@/lib/logger/index.js"

interface RouteParams {
  params: Promise<{ sessionId: string; skillId: string }>
}

/**
 * GET /api/{sessionId}/skills/[skillId]
 * Get a single skill (session-scoped)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, skillId } = await params

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

    const skill = db
      .prepare('SELECT * FROM skills WHERE id = ? AND workspace_id = ?')
      .get(skillId, workspaceId) as any

    if (!skill) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      )
    }

    // Fetch full content from file path if needed
    if (skill.is_content_from_path === 1 && skill.path) {
      try {
        const { readFile } = await import('fs/promises')
        const { join } = await import('path')
        const fullPath = join(process.cwd(), skill.path)
        skill.skill_data = await readFile(fullPath, 'utf-8')
      } catch (error) {
        logger.warn(`Failed to read skill file at ${skill.path}:`, error)
      }
    }

    return NextResponse.json({
      skill: {
        id: skill.id,
        workspace_id: skill.workspace_id,
        skill_name: skill.skill_name,
        skill_description: skill.skill_description,
        skill_data: skill.skill_data,
        source: skill.source,
        external_id: skill.external_id,
        tags: skill.tags,
        path: skill.path,
        is_content_from_path: skill.is_content_from_path === 1,
        github_url: skill.github_url,
        skill_url: skill.skill_url,
        is_active: skill.is_active === 1,
        created_at: skill.created_at,
        updated_at: skill.updated_at,
        created_by: skill.created_by,
      }
    })
  } catch (error) {
    logger.error('Error fetching skill (session-scoped):', error)
    return NextResponse.json({ error: 'Failed to fetch skill' }, { status: 500 })
  }
}

/**
 * PATCH /api/{sessionId}/skills/[skillId]
 * Update a skill (session-scoped)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, skillId } = await params

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

    const body = await request.json()
    const { skill_name, skill_description, skill_data, tags, is_active } = body

    // Verify skill exists
    const existing = db
      .prepare('SELECT * FROM skills WHERE id = ? AND workspace_id = ?')
      .get(skillId, workspaceId) as any

    if (!existing) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      )
    }

    const updates: string[] = []
    const values: any[] = []

    if (skill_name !== undefined) {
      updates.push('skill_name = ?')
      values.push(skill_name)
    }

    if (skill_description !== undefined) {
      updates.push('skill_description = ?')
      values.push(skill_description)
    }

    if (skill_data !== undefined) {
      updates.push('skill_data = ?')
      values.push(skill_data)
    }

    if (tags !== undefined) {
      updates.push('tags = ?')
      values.push(tags)
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?')
      values.push(is_active ? 1 : 0)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { message: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(skillId)

    db.prepare(`
      UPDATE skills SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId) as any

    return NextResponse.json({
      skill: {
        id: updated.id,
        workspace_id: updated.workspace_id,
        skill_name: updated.skill_name,
        skill_description: updated.skill_description,
        skill_data: updated.skill_data,
        source: updated.source,
        external_id: updated.external_id,
        tags: updated.tags,
        is_active: updated.is_active === 1,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        created_by: updated.created_by,
      }
    })
  } catch (error) {
    logger.error('Error updating skill (session-scoped):', error)
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 })
  }
}

/**
 * DELETE /api/{sessionId}/skills/[skillId]
 * Delete a skill (session-scoped)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId, skillId } = await params

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

    const result = db
      .prepare('DELETE FROM skills WHERE id = ? AND workspace_id = ?')
      .run(skillId, workspaceId)

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting skill (session-scoped):', error)
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 })
  }
}
