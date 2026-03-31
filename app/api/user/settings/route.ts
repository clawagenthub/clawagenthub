import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import type { UserSettings } from '@/lib/db/schema'

/**
 * GET /api/user/settings
 * Fetch user settings including chat summarizer preferences
 */
export async function GET(request: Request) {
  try {
    const db = getDatabase()

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized')
    }

    const settings = db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .get(auth.user.id) as UserSettings | undefined

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        settings: {
          id: null,
          user_id: auth.user.id,
          summarizer_agent_id: null,
          summarizer_gateway_id: null,
          auto_summary_enabled: true,
          idle_timeout_minutes: 2,
          created_at: null,
          updated_at: null,
        },
      })
    }

    // Convert SQLite boolean (0/1) to boolean
    return NextResponse.json({
      settings: {
        ...settings,
        auto_summary_enabled: Boolean(settings.auto_summary_enabled),
      },
    })
  } catch (error) {
    console.error('[API /api/user/settings] Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

/**
 * PUT /api/user/settings
 * Update user settings
 */
export async function PUT(request: Request) {
  try {
    const db = getDatabase()

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized')
    }

    const body = await request.json()
    const {
      summarizer_agent_id,
      summarizer_gateway_id,
      auto_summary_enabled,
      idle_timeout_minutes,
    } = body

    // Validate input
    if (typeof auto_summary_enabled !== 'boolean') {
      return NextResponse.json({ error: 'auto_summary_enabled must be a boolean' }, { status: 400 })
    }

    if (idle_timeout_minutes !== undefined && (typeof idle_timeout_minutes !== 'number' || idle_timeout_minutes < 1)) {
      return NextResponse.json({ error: 'idle_timeout_minutes must be a number >= 1' }, { status: 400 })
    }

    // Check if settings exist
    const existing = db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .get(auth.user.id) as UserSettings | undefined

    const now = new Date().toISOString()

    if (existing) {
      // Update existing settings
      db.prepare(`
        UPDATE user_settings
        SET summarizer_agent_id = ?,
            summarizer_gateway_id = ?,
            auto_summary_enabled = ?,
            idle_timeout_minutes = ?,
            updated_at = ?
        WHERE user_id = ?
      `).run(
        summarizer_agent_id || null,
        summarizer_gateway_id || null,
        auto_summary_enabled ? 1 : 0,
        idle_timeout_minutes ?? 2,
        now,
        auth.user.id
      )
    } else {
      // Create new settings
      const settingsId = `usrset_${crypto.randomUUID()}`
      db.prepare(`
        INSERT INTO user_settings (id, user_id, summarizer_agent_id, summarizer_gateway_id, auto_summary_enabled, idle_timeout_minutes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        settingsId,
        auth.user.id,
        summarizer_agent_id || null,
        summarizer_gateway_id || null,
        auto_summary_enabled ? 1 : 0,
        idle_timeout_minutes ?? 2,
        now,
        now
      )
    }

    // Fetch and return updated settings
    const settings = db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .get(auth.user.id) as UserSettings

    return NextResponse.json({
      settings: {
        ...settings,
        auto_summary_enabled: Boolean(settings.auto_summary_enabled),
      },
    })
  } catch (error) {
    console.error('[API /api/user/settings] Error updating settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
