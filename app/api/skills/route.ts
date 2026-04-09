import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import type { Skill, SkillInsert } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'


/**
 * GET /api/skills
 * Fetch all skills for the current workspace with search and filtering
 */
export async function GET(request: NextRequest) {
  try {
    await ensureDatabase()

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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const source = searchParams.get('source') || ''
    const isActive = searchParams.get('is_active')
    const tags = searchParams.get('tags') || ''

    // Build query with filters
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
    const params: any[] = [session.current_workspace_id]

    // Add search filter (case-insensitive)
    if (search) {
      query += ` AND (LOWER(s.skill_name) LIKE ? OR LOWER(s.skill_description) LIKE ?)`
      const searchPattern = `%${search.toLowerCase()}%`
      params.push(searchPattern, searchPattern)
    }

    // Add source filter
    if (source && ['custom', 'skillsmp', 'imported'].includes(source)) {
      query += ` AND s.source = ?`
      params.push(source)
    }

    // Add active filter
    if (isActive !== null) {
      query += ` AND s.is_active = ?`
      params.push(isActive === 'true' ? 1 : 0)
    }

    // Add tags filter (simple JSON contains check)
    if (tags) {
      const tagList = tags.split(',')
      for (const tag of tagList) {
        query += ` AND s.tags LIKE ?`
        params.push(`%"${tag.trim()}"%`)
      }
    }

    query += ` GROUP BY s.id ORDER BY s.created_at DESC`

    const skills = db.prepare(query).all(...params)

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
        created_by: skill.created_by,
        status_count: skill.status_count || 0,
        created_by_email: skill.created_by_email,
      }))
    })
  } catch (error) {
    logger.error('Error fetching skills:', error)
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 })
  }
}

/**
 * POST /api/skills
 * Create a new skill
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDatabase()

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

    // Verify workspace membership
    const member = db
      .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get(session.current_workspace_id, user.id)

    if (!member) {
      return NextResponse.json(
        { message: 'Forbidden - Not a workspace member' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { skill_name, skill_description, skill_data, source = 'custom', tags, external_id } = body

    // Validate required fields
    if (!skill_name || !skill_data) {
      return NextResponse.json({ error: 'skill_name and skill_data are required' }, { status: 400 })
    }

    // Validate source
    if (!['custom', 'skillsmp', 'imported'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    }

    // Generate ID
    const skillId = `skill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // Insert skill
    const stmt = db.prepare(`
      INSERT INTO skills (id, workspace_id, skill_name, skill_description, skill_data, source, external_id, tags, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      skillId,
      session.current_workspace_id,
      skill_name,
      skill_description || null,
      skill_data,
      source,
      external_id || null,
      tags || null,
      1,
      user.id
    )

    // Fetch created skill
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
    logger.error('Error creating skill:', error)
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 })
  }
}