import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import logger from "@/lib/logger/index.js"


/**
 * GET /api/chat/sessions/idle-check
 * Find sessions that have been idle for longer than their configured timeout
 * and are eligible for auto-summary
 * 
 * This endpoint is called by a background job or cron to find sessions
 * that should be automatically summarized
 */
export async function GET(request: Request) {
  try {
    const db = getDatabase()
    
    // Get all users with auto-summary enabled
    const usersWithAutoSummary = db
      .prepare(`
        SELECT us.user_id, us.idle_timeout_minutes, us.summarizer_agent_id, us.summarizer_gateway_id
        FROM user_settings us
        WHERE us.auto_summary_enabled = 1
          AND us.summarizer_agent_id IS NOT NULL
          AND us.summarizer_gateway_id IS NOT NULL
      `)
      .all() as Array<{
        user_id: string
        idle_timeout_minutes: number
        summarizer_agent_id: string
        summarizer_gateway_id: string
      }>

    const idleSessions: Array<{
      session_id: string
      user_id: string
      title: string | null
      agent_name: string
      last_activity_at: string
      idle_minutes: number
      timeout_minutes: number
    }> = []

    const now = Date.now()

    // For each user, find their idle sessions
    for (const user of usersWithAutoSummary) {
      const timeoutMs = user.idle_timeout_minutes * 60 * 1000
      const idleThreshold = new Date(now - timeoutMs).toISOString()

      // Find sessions that:
      // 1. Belong to this user
      // 2. Have last_activity_at before the idle threshold
      // 3. Have status of 'active' or 'idle' (not already summarized/inactive)
      // 4. Have at least one message (don't summarize empty sessions)
      const sessions = db
        .prepare(`
          SELECT 
            cs.id as session_id,
            cs.user_id,
            cs.title,
            cs.agent_name,
            cs.last_activity_at,
            cs.status,
            COUNT(cm.id) as message_count
          FROM chat_sessions cs
          LEFT JOIN chat_messages cm ON cm.session_id = cs.id
          WHERE cs.user_id = ?
            AND cs.last_activity_at < ?
            AND cs.status IN ('active', 'idle')
          GROUP BY cs.id
          HAVING message_count > 0
          ORDER BY cs.last_activity_at ASC
        `)
        .all(user.user_id, idleThreshold) as Array<{
          session_id: string
          user_id: string
          title: string | null
          agent_name: string
          last_activity_at: string
          status: string
          message_count: number
        }>

      for (const session of sessions) {
        const lastActivity = new Date(session.last_activity_at).getTime()
        const idleMinutes = Math.floor((now - lastActivity) / 60000)
        
        idleSessions.push({
          session_id: session.session_id,
          user_id: session.user_id,
          title: session.title,
          agent_name: session.agent_name,
          last_activity_at: session.last_activity_at,
          idle_minutes: idleMinutes,
          timeout_minutes: user.idle_timeout_minutes,
        })
      }
    }

    return NextResponse.json({
      sessions: idleSessions,
      count: idleSessions.length,
    })
  } catch (error) {
    logger.error('[Chat API] Error checking idle sessions:', error)
    return NextResponse.json(
      { error: 'Failed to check idle sessions' },
      { status: 500 }
    )
  }
}
