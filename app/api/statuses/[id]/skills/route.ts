import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import logger from '@/lib/logger/index.js'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/statuses/[id]/skills
 * Fetch all skills attached to a specific status
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDatabase()
    const { id: statusId } = await context.params
    
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const user = getUserFromSession(sessionToken)
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const db = getDatabase()

    // Verify workspace membership
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No workspace' }, { status: 400 })
    }

    // Verify status belongs to workspace
    const status = db
      .prepare('SELECT * FROM statuses WHERE id = ? AND workspace_id = ?')
      .get(statusId, session.current_workspace_id)

    if (!status) {
      return NextResponse.json({ message: 'Status not found' }, { status: 404 })
    }

    // Fetch skills attached to this status via junction table
    const skills = db.prepare(`
      SELECT s.*, ss.priority as attachment_priority
      FROM status_skills ss
      JOIN skills s ON ss.skill_id = s.id
      WHERE ss.status_id = ? AND s.workspace_id = ? AND s.is_active = 1
      ORDER BY ss.priority ASC
    `).all(statusId, session.current_workspace_id)

    return NextResponse.json({
      skills: (skills as any[]).map((skill: any) => ({
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
        priority: skill.attachment_priority,
      }))
    })
  } catch (error) {
    logger.error('Error fetching status skills:', error)
    return NextResponse.json({ error: 'Failed to fetch status skills' }, { status: 500 })
  }
}

/**
 * PUT /api/statuses/[id]/skills
 * Update skills attached to a status (replace all)
 * Body: { skill_ids: string[] }
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDatabase()
    const { id: statusId } = await context.params
    
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const user = getUserFromSession(sessionToken)
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { skill_ids } = body

    if (!Array.isArray(skill_ids)) {
      return NextResponse.json({ error: 'skill_ids must be an array' }, { status: 400 })
    }

    const db = getDatabase()

    // Verify workspace membership
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No workspace' }, { status: 400 })
    }

    // Verify status belongs to workspace
    const status = db
      .prepare('SELECT * FROM statuses WHERE id = ? AND workspace_id = ?')
      .get(statusId, session.current_workspace_id)

    if (!status) {
      return NextResponse.json({ message: 'Status not found' }, { status: 404 })
    }

    // Check user is owner or admin
    const member = db
      .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get(session.current_workspace_id, user.id) as { role: string } | undefined

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // Validate all skill_ids exist and belong to workspace
    if (skill_ids.length > 0) {
      const placeholders = skill_ids.map(() => '?').join(',')
      const validSkills = db.prepare(`
        SELECT id FROM skills 
        WHERE id IN (${placeholders}) AND workspace_id = ? AND is_active = 1
      `).all(...skill_ids, session.current_workspace_id) as { id: string }[]

      const validIds = new Set(validSkills.map(s => s.id))
      const invalidIds = skill_ids.filter(id => !validIds.has(id))
      
      if (invalidIds.length > 0) {
        return NextResponse.json({
          error: 'Some skills are invalid or do not belong to this workspace',
          invalid_ids: invalidIds
        }, { status: 400 })
      }
    }

    // Delete existing associations
    db.prepare('DELETE FROM status_skills WHERE status_id = ?').run(statusId)

    // Insert new associations with priority order
    if (skill_ids.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO status_skills (status_id, skill_id, priority, created_at)
        VALUES (?, ?, ?, ?)
      `)
      
      const now = new Date().toISOString()
      for (let i = 0; i < skill_ids.length; i++) {
        insertStmt.run(statusId, skill_ids[i], i, now)
      }
    }

    logger.info(`Updated skills for status ${statusId}:`, { skill_ids })

    return NextResponse.json({
      success: true,
      skill_ids,
      count: skill_ids.length
    })
  } catch (error) {
    logger.error('Error updating status skills:', error)
    return NextResponse.json({ error: 'Failed to update status skills' }, { status: 500 })
  }
}
