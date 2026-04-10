import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db/index.js'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/skills/marketplace
 * Get skill marketplace listings (session-scoped)
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
    const category = searchParams.get('category') || ''

    // Marketplace skills are typically from 'skillsmp' source or have marketplace flags
    let query = `
      SELECT s.*, u.email as created_by_email
      FROM skills s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.source = 'skillsmp'
        AND s.is_active = 1
    `
    const queryParams: any[] = []

    if (search) {
      query += ` AND (LOWER(s.skill_name) LIKE ? OR LOWER(s.skill_description) LIKE ?)`
      const searchPattern = `%${search.toLowerCase()}%`
      queryParams.push(searchPattern, searchPattern)
    }

    if (category) {
      query += ` AND s.tags LIKE ?`
      queryParams.push(`%"${category}"%`)
    }

    query += ` ORDER BY s.skill_name ASC`

    const marketplaceSkills = db.prepare(query).all(...queryParams) as any[]

    return NextResponse.json({
      marketplace: marketplaceSkills.map(skill => ({
        id: skill.id,
        skill_name: skill.skill_name,
        skill_description: skill.skill_description,
        source: skill.source,
        external_id: skill.external_id,
        tags: skill.tags,
        skill_url: skill.skill_url,
        created_by_email: skill.created_by_email,
        created_at: skill.created_at
      }))
    })
  } catch (error) {
    logger.error('Error fetching marketplace skills (session-scoped):', error)
    return NextResponse.json({ error: 'Failed to fetch marketplace' }, { status: 500 })
  }
}
