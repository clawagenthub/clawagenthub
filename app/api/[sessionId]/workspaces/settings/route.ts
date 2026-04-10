import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { generateUserId } from '@/lib/auth/token.js'
import { getDatabase } from '@/lib/db/index.js'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/workspaces/settings
 * Get workspace settings (session-scoped)
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

    const settings = db
      .prepare(`
        SELECT * FROM workspace_settings
        WHERE workspace_id = ?
        ORDER BY setting_key
      `)
      .all(workspaceId) as any[]

    return NextResponse.json({
      settings: settings.reduce((acc, s) => {
        acc[s.setting_key] = s.setting_value
        return acc
      }, {} as Record<string, string | null>)
    })
  } catch (error) {
    logger.error('Error fetching workspace settings (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/{sessionId}/workspaces/settings
 * Update workspace settings (session-scoped, admin/owner only)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
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

    // Check if user is owner or admin
    const member = db
      .prepare(`SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`)
      .get(workspaceId, verification.user.id) as { role: string } | undefined

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json(
        { message: 'Forbidden - Only owners and admins can modify settings' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updates: Array<{ key: string; value: string | null }> = []

    // Validate and collect updates
    for (const [key, value] of Object.entries(body)) {
      if (typeof key !== 'string' || key.trim().length === 0) {
        return NextResponse.json(
          { message: 'Invalid setting key' },
          { status: 400 }
        )
      }

      if (value !== null && typeof value !== 'string') {
        return NextResponse.json(
          { message: 'Setting value must be a string or null' },
          { status: 400 }
        )
      }

      updates.push({ key: key.trim(), value: value as string | null })
    }

    const now = new Date().toISOString()

    // Upsert each setting
    for (const { key, value } of updates) {
      const existing = db
        .prepare('SELECT id FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?')
        .get(workspaceId, key)

      if (existing) {
        db.prepare(`
          UPDATE workspace_settings SET setting_value = ?, updated_at = ? WHERE workspace_id = ? AND setting_key = ?
        `).run(value, now, workspaceId, key)
      } else {
        db.prepare(`
          INSERT INTO workspace_settings (id, workspace_id, setting_key, setting_value, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(generateUserId(), workspaceId, key, value, now, now)
      }
    }

    // Return updated settings
    const settings = db
      .prepare(`
        SELECT * FROM workspace_settings
        WHERE workspace_id = ?
        ORDER BY setting_key
      `)
      .all(workspaceId) as any[]

    return NextResponse.json({
      settings: settings.reduce((acc, s) => {
        acc[s.setting_key] = s.setting_value
        return acc
      }, {} as Record<string, string | null>)
    })
  } catch (error) {
    logger.error('Error updating workspace settings (session-scoped):', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
