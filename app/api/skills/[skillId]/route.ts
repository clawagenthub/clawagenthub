import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Skill, SkillUpdate } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"


interface RouteParams {
  params: Promise<{ skillId: string }>
}

/**
 * GET /api/skills/[skillId]
 * Get a specific skill by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { skillId } = await params

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

    // Fetch skill with metadata
    const skill = db.prepare(`
      SELECT
        s.*,
        COUNT(DISTINCT ss.status_id) as status_count,
        u.email as created_by_email
      FROM skills s
      LEFT JOIN status_skills ss ON s.id = ss.skill_id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ? AND s.workspace_id = ?
      GROUP BY s.id
    `).get(skillId, session.current_workspace_id) as any

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    // Read content from file if is_content_from_path is true
    let skillContent = skill.skill_data
    if (skill.is_content_from_path === 1 && skill.path) {
      try {
        const { readFile } = await import('fs/promises')
        const { join } = await import('path')
        const fullPath = join(process.cwd(), skill.path)
        skillContent = await readFile(fullPath, 'utf-8')
      } catch (error) {
        logger.error(`Error reading skill file from ${skill.path}:`, error)
        // Fall back to skill_data from database
        skillContent = skill.skill_data
      }
    }

    return NextResponse.json({
      skill: {
        id: skill.id,
        workspace_id: skill.workspace_id,
        skill_name: skill.skill_name,
        skill_description: skill.skill_description,
        skill_data: skillContent,
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
        status_count: skill.status_count || 0,
        created_by_email: skill.created_by_email,
      }
    })
  } catch (error) {
    logger.error('Error fetching skill:', error)
    return NextResponse.json({ error: 'Failed to fetch skill' }, { status: 500 })
  }
}

/**
 * PUT /api/skills/[skillId]
 * Update an existing skill
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { skillId } = await params

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

    // Verify skill belongs to workspace
    const existingSkill = db.prepare('SELECT * FROM skills WHERE id = ? AND workspace_id = ?')
      .get(skillId, session.current_workspace_id) as Skill | undefined

    if (!existingSkill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    const body = await request.json()
    const { skill_name, skill_description, skill_data, tags } = body

    // If skill uses local file and skill_data is being updated, write to file
    if (skill_data !== undefined && existingSkill.is_content_from_path && existingSkill.path) {
      try {
        const { writeFile } = await import('fs/promises')
        const { join } = await import('path')
        const fullPath = join(process.cwd(), existingSkill.path)
        await writeFile(fullPath, skill_data, 'utf-8')
        logger.debug(`Updated skill file: ${existingSkill.path}`)
      } catch (error) {
        logger.error(`Error writing skill file to ${existingSkill.path}:`, error)
        return NextResponse.json({ error: 'Failed to update skill file' }, { status: 500 })
      }
    }

    // Build update query dynamically
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
    // Only update skill_data in DB if not using local file
    if (skill_data !== undefined && !existingSkill.is_content_from_path) {
      updates.push('skill_data = ?')
      values.push(skill_data)
    }
    if (tags !== undefined) {
      updates.push('tags = ?')
      values.push(tags)
    }

    // Always include updated_at
    const now = new Date().toISOString()
    updates.push('updated_at = ?')
    values.push(now)
    values.push(skillId)

    if (updates.length > 0) {
      const query = `UPDATE skills SET ${updates.join(', ')} WHERE id = ?`
      db.prepare(query).run(...values)
    }

    // Fetch updated skill
    const updatedSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId) as any

    return NextResponse.json({
      skill: {
        id: updatedSkill.id,
        workspace_id: updatedSkill.workspace_id,
        skill_name: updatedSkill.skill_name,
        skill_description: updatedSkill.skill_description,
        skill_data: updatedSkill.skill_data,
        source: updatedSkill.source,
        external_id: updatedSkill.external_id,
        tags: updatedSkill.tags,
        is_active: updatedSkill.is_active === 1,
        created_at: updatedSkill.created_at,
        updated_at: updatedSkill.updated_at,
        created_by: updatedSkill.created_by,
      }
    })
  } catch (error) {
    logger.error('Error updating skill:', error)
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 })
  }
}

/**
 * DELETE /api/skills/[skillId]
 * Soft delete a skill (set is_active = false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase()

    const { skillId } = await params

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

    // Verify skill belongs to workspace
    const existingSkill = db.prepare('SELECT * FROM skills WHERE id = ? AND workspace_id = ?')
      .get(skillId, session.current_workspace_id) as any

    if (!existingSkill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    // Delete local file if exists
    if (existingSkill.is_content_from_path === 1 && existingSkill.path) {
      try {
        const { unlink, rmdir } = await import('fs/promises')
        const { join, dirname } = await import('path')
        
        const fullPath = join(process.cwd(), existingSkill.path)
        await unlink(fullPath)
        logger.debug(`Deleted skill file: ${existingSkill.path}`)
        
        // Try to remove empty parent directory
        const dirPath = dirname(fullPath)
        try {
          await rmdir(dirPath)
          logger.debug(`Removed empty directory: ${dirname(existingSkill.path)}`)
        } catch {
          // Directory not empty or doesn't exist, ignore
        }
      } catch (error) {
        logger.error(`Error deleting skill file ${existingSkill.path}:`, error)
        // Continue with soft delete even if file deletion fails
      }
    }

    // Soft delete
    const now = new Date().toISOString()
    db.prepare('UPDATE skills SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(now, skillId)

    return NextResponse.json({
      success: true,
      message: 'Skill deleted successfully'
    })
  } catch (error) {
    logger.error('Error deleting skill:', error)
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 })
  }
}