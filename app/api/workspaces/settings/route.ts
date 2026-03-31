import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { generateUserId } from '@/lib/auth/token.js'

// GET /api/workspaces/settings - Fetch all settings for current workspace
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
    const session = db.prepare(
      'SELECT current_workspace_id FROM sessions WHERE token = ?'
    ).get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const workspaceId = session.current_workspace_id

    // Verify user is a member of this workspace
    const member = db.prepare(
      'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, user.id) as { id: string } | undefined

    if (!member) {
      return NextResponse.json(
        { message: 'Not a member of this workspace' },
        { status: 403 }
      )
    }

    // Fetch all settings for this workspace
    const settings = db.prepare(
      'SELECT setting_key, setting_value FROM workspace_settings WHERE workspace_id = ?'
    ).all(workspaceId) as Array<{ setting_key: string; setting_value: string | null }>

    // Convert to key-value object
    const settingsObj: Record<string, string | null> = {}
    for (const setting of settings) {
      settingsObj[setting.setting_key] = setting.setting_value
    }

    return NextResponse.json(settingsObj)
  } catch (error) {
    console.error('Error fetching workspace settings:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/workspaces/settings - Update workspace settings
export async function PUT(request: NextRequest) {
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

    const body = await request.json().catch(() => ({})) as Record<string, string | null>

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { message: 'Invalid request body' },
        { status: 400 }
      )
    }

    const db = getDatabase()

    // Get user's current workspace
    const session = db.prepare(
      'SELECT current_workspace_id FROM sessions WHERE token = ?'
    ).get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const workspaceId = session.current_workspace_id

    // Verify user is a member of this workspace
    const member = db.prepare(
      'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, user.id) as { id: string } | undefined

    if (!member) {
      return NextResponse.json(
        { message: 'Not a member of this workspace' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    // Update each setting
    for (const [key, value] of Object.entries(body)) {
      // Validate setting key (alphanumeric, underscores, hyphens only)
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return NextResponse.json(
          { message: `Invalid setting key: ${key}` },
          { status: 400 }
        )
      }

      // Validate setting value (max 50000 characters)
      if (value !== null && typeof value === 'string' && value.length > 50000) {
        return NextResponse.json(
          { message: `Setting value too long for key: ${key}` },
          { status: 400 }
        )
      }

      // Check if setting exists
      const existing = db.prepare(
        'SELECT id FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?'
      ).get(workspaceId, key) as { id: string } | undefined

      if (existing) {
        // Update existing setting
        if (value === null || value === '') {
          // Delete if value is null or empty string
          db.prepare(
            'DELETE FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?'
          ).run(workspaceId, key)
        } else {
          db.prepare(
            'UPDATE workspace_settings SET setting_value = ?, updated_at = ? WHERE workspace_id = ? AND setting_key = ?'
          ).run(value, now, workspaceId, key)
        }
      } else {
        // Insert new setting (only if value is not null/empty)
        if (value !== null && value !== '') {
          const settingId = generateUserId()
          db.prepare(
            'INSERT INTO workspace_settings (id, workspace_id, setting_key, setting_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(settingId, workspaceId, key, value, now, now)
        }
      }
    }

    // Fetch and return all settings
    const settings = db.prepare(
      'SELECT setting_key, setting_value FROM workspace_settings WHERE workspace_id = ?'
    ).all(workspaceId) as Array<{ setting_key: string; setting_value: string | null }>

    const settingsObj: Record<string, string | null> = {}
    for (const setting of settings) {
      settingsObj[setting.setting_key] = setting.setting_value
    }

    return NextResponse.json(settingsObj)
  } catch (error) {
    console.error('Error updating workspace settings:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
