import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'
import { getProjects, createProject, getProjectById } from '@/lib/db/index.js'
import { z } from 'zod'
import logger from "@/lib/logger/index.js"

const projectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  value: z.string().max(5000).optional(),
})

/**
 * GET /api/projects
 * Get all projects for the current workspace
 */
export async function GET(request: NextRequest) {
  try {
    await ensureDatabase()
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
    const session = db.prepare('SELECT current_workspace_id FROM sessions WHERE token = ?').get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No workspace selected' }, { status: 400 })
    }

    const projects = getProjects(db, session.current_workspace_id)
    return NextResponse.json({ projects })
  } catch (error) {
    logger.error('Error fetching projects:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDatabase()
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
    const parseResult = projectSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Invalid input', errors: parseResult.error.errors }, { status: 400 })
    }

    const db = getDatabase()
    const session = db.prepare('SELECT current_workspace_id FROM sessions WHERE token = ?').get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No workspace selected' }, { status: 400 })
    }

    // Check for duplicate name in workspace
    const existing = db.prepare('SELECT id FROM workspace_projects WHERE workspace_id = ? AND LOWER(name) = LOWER(?)').get(session.current_workspace_id, body.name.trim())
    if (existing) {
      return NextResponse.json({ message: 'A project with this name already exists' }, { status: 409 })
    }

    const project = createProject(db, {
      id: generateUserId(),
      workspace_id: session.current_workspace_id,
      name: body.name.trim(),
      description: body.description?.trim(),
      value: body.value?.trim(),
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    logger.error('Error creating project:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}