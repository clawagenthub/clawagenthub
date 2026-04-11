import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { generateUserId } from '@/lib/auth/token.js'
import { getDatabase } from '@/lib/db/index.js'
import { getProjects, createProject } from '@/lib/db/index.js'
import { z } from 'zod'
import logger from "@/lib/logger/index.js"

const projectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  value: z.string().max(5000).optional(),
})

/**
 * GET /api/{sessionId}/projects
 * Get all projects for the current workspace (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

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

    const projects = getProjects(db, workspaceId)
    return NextResponse.json({ projects })
  } catch (error) {
    logger.error('Error fetching projects (session-scoped):', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/{sessionId}/projects
 * Create a new project (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

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
    const parseResult = projectSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Invalid input', errors: parseResult.error.errors }, { status: 400 })
    }

    // Check for duplicate name in workspace
    const existing = db.prepare('SELECT id FROM workspace_projects WHERE workspace_id = ? AND LOWER(name) = LOWER(?)').get(workspaceId, body.name.trim())
    if (existing) {
      return NextResponse.json({ message: 'A project with this name already exists' }, { status: 409 })
    }

    const project = createProject(db, {
      id: generateUserId(),
      workspace_id: workspaceId,
      name: body.name.trim(),
      description: body.description?.trim(),
      value: body.value?.trim(),
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    logger.error('Error creating project (session-scoped):', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
