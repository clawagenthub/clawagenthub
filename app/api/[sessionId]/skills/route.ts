import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { generateUserId } from '@/lib/auth/token.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Skill } from '@/lib/db/schema.js'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/skills
 * Fetch all skills for the current workspace (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const source = searchParams.get('source') || ''
    const isActive = searchParams.get('is_active')
    const tags = searchParams.get('tags') || ''

    let query = `
      SELECT
        s.*,
        COUNT(DISTINCT ss.status_id) as status_count,
        u.email as created_by_email
      FROM skills s
      LEFT JOIN status_skills ss ON s.id = ss.skill_id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.workspace_id = ?
        AND s.is_active = 1
    `
    const params2: any[] = [workspaceId]

    if (search) {
      query += ` AND (LOWER(s.skill_name) LIKE ? OR LOWER(s.skill_description) LIKE ?)`
      const searchPattern = `%${search.toLowerCase()}%`
      params2.push(searchPattern, searchPattern)
    }

    if (source && ['custom', 'skillsmp', 'imported'].includes(source)) {
      query += ` AND s.source = ?`
      params2.push(source)
    }

    if (isActive !== null) {
      query += ` AND s.is_active = ?`
      params2.push(isActive === 'true' ? 1 : 0)
    }

    if (tags) {
      const tagList = tags.split(',')
      for (const tag of tagList) {
        query += ` AND s.tags LIKE ?`
        params2.push(`%"${tag.trim()}"%`)
      }
    }

    query += ` GROUP BY s.id ORDER BY s.created_at DESC`

    const skills = db.prepare(query).all(...params2) as any[]

    // Fetch full content from file path
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')

    const skillsWithFullContent = await Promise.all(
      skills.map(async (skill: any) => {
        if (skill.is_content_from_path === 1 && skill.path) {
          try {
            const fullPath = join(process.cwd(), skill.path)
            skill.skill_data = await readFile(fullPath, 'utf-8')
          } catch (error) {
            logger.warn(`Failed to read skill file at ${skill.path}:`, error)
          }
        }
        return {
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
          status_count: skill.status_count || 0,
          created_by_email: skill.created_by_email,
        }
      })
    )

    return NextResponse.json({
      skills: skillsWithFullContent
    })
  } catch (error) {
    logger.error('Error fetching skills (session-scoped):', error)
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 })
  }
}

/**
 * POST /api/{sessionId}/skills
 * Create a new skill (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

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

    // Verify workspace membership
    const member = db
      .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get(workspaceId, verification.user.id)

    if (!member) {
      return NextResponse.json(
        { message: 'Forbidden - Not a workspace member' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { skill_name, skill_description, skill_data, source = 'custom', tags, external_id } = body

    if (!skill_name || !skill_data) {
      return NextResponse.json({ error: 'skill_name and skill_data are required' }, { status: 400 })
    }

    if (!['custom', 'skillsmp', 'imported'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    }

    const skillId = `skill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    db.prepare(`
      INSERT INTO skills (id, workspace_id, skill_name, skill_description, skill_data, source, external_id, tags, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      skillId,
      workspaceId,
      skill_name,
      skill_description || null,
      skill_data,
      source,
      external_id || null,
      tags || null,
      1,
      verification.user.id
    )

    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId) as any

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
        is_active: skill.is_active === 1,
        created_at: skill.created_at,
        updated_at: skill.updated_at,
        created_by: skill.created_by,
      }
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating skill (session-scoped):', error)
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 })
  }
}
