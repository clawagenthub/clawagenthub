import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getProjectById, updateProject, deleteProject } from '@/lib/db/index.js'
import { z } from 'zod'
import logger from "@/lib/logger/index.js"

const projectUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  value: z.string().max(255).optional().nullable(),
})

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]
 * Get a single project
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await ensureDatabase()
    const { id } = await params
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
    const project = getProjectById(db, id)

    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    logger.error('Error fetching project:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/projects/[id]
 * Update a project
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    await ensureDatabase()
    const { id } = await params
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
    const parseResult = projectUpdateSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Invalid input', errors: parseResult.error.errors }, { status: 400 })
    }

    const db = getDatabase()
    const existing = getProjectById(db, id)

    if (!existing) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 })
    }

    // Check for duplicate name if name is being updated
    if (body.name && body.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = db.prepare('SELECT id FROM workspace_projects WHERE workspace_id = ? AND LOWER(name) = LOWER(?) AND id != ?').get(existing.workspace_id, body.name.trim(), id)
      if (duplicate) {
        return NextResponse.json({ message: 'A project with this name already exists' }, { status: 409 })
      }
    }

    const project = updateProject(db, id, {
      name: body.name?.trim(),
      description: body.description?.trim(),
      value: body.value?.trim(),
    })

    return NextResponse.json({ project })
  } catch (error) {
    logger.error('Error updating project:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await ensureDatabase()
    const { id } = await params
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
    const existing = getProjectById(db, id)

    if (!existing) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 })
    }

    const deleted = deleteProject(db, id)

    if (!deleted) {
      return NextResponse.json({ message: 'Failed to delete project' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Project deleted' })
  } catch (error) {
    logger.error('Error deleting project:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}