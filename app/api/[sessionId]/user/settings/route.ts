import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifySession } from '@/lib/session/verify'
import { getDatabase } from '@/lib/db'
import type { UserSettings } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/user/settings
 * Fetch user settings including chat summarizer preferences (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    await ensureDatabase()
    const db = getDatabase()

    const settings = db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .get(verification.user.id) as UserSettings | undefined

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        settings: {
          id: null,
          user_id: verification.user.id,
          summarizer_agent_id: null,
          summarizer_gateway_id: null,
          auto_summary_enabled: true,
          idle_timeout_minutes: 2,
          created_at: null,
          updated_at: null,
        },
      })
    }

    return NextResponse.json({
      settings: {
        ...settings,
        auto_summary_enabled: Boolean(settings.auto_summary_enabled),
      },
    })
  } catch (error) {
    logger.error('[API /api/{sessionId}/user/settings] Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

/**
 * PUT /api/{sessionId}/user/settings
 * Update user settings (session-scoped)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    await ensureDatabase()
    const db = getDatabase()

    const body = await request.json()
    const {
      summarizer_agent_id,
      summarizer_gateway_id,
      auto_summary_enabled,
      idle_timeout_minutes,
    } = body

    // Validate input
    if (auto_summary_enabled !== undefined && typeof auto_summary_enabled !== 'boolean') {
      return NextResponse.json({ error: 'auto_summary_enabled must be a boolean' }, { status: 400 })
    }

    if (idle_timeout_minutes !== undefined && (typeof idle_timeout_minutes !== 'number' || idle_timeout_minutes < 1)) {
      return NextResponse.json({ error: 'idle_timeout_minutes must be a number >= 1' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Check if settings exist
    const existing = db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .get(verification.user.id) as UserSettings | undefined

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
        verification.user.id
      )
    } else {
      // Create new settings
      const settingsId = `usrset_${crypto.randomUUID()}`
      db.prepare(`
        INSERT INTO user_settings (id, user_id, summarizer_agent_id, summarizer_gateway_id, auto_summary_enabled, idle_timeout_minutes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        settingsId,
        verification.user.id,
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
      .get(verification.user.id) as UserSettings

    return NextResponse.json({
      settings: {
        ...settings,
        auto_summary_enabled: Boolean(settings.auto_summary_enabled),
      },
    })
  } catch (error) {
    logger.error('[API /api/{sessionId}/user/settings] Error updating settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
