/**
 * Gateway Session Persistence
 * 
 * Handles persisting chat messages to the database.
 */

import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/db'
export interface PersistMessageOptions {
  sessionId: string
  content: string
  role: 'user' | 'assistant'
  runId: string
  source?: string
}

/**
 * Persist a user message to the database
 */
export function persistMessage(options: PersistMessageOptions): void {
  const { sessionId, content, role, runId, source = 'instance-bridge' } = options

  try {
    const db = getDatabase()
    const now = new Date().toISOString()
    const contentBlocks = JSON.stringify([{ type: 'text', text: content }])
    const metadata = JSON.stringify({ runId, source })

    db.prepare(
      `INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), sessionId, role, contentBlocks, metadata, now)

    db.prepare(
      `UPDATE chat_sessions
       SET status = 'active', last_activity_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(now, now, sessionId)
  } catch (error) {
    console.error(`[SessionInstance] Failed to persist ${role} message:`, {
      sessionId,
      runId,
      error
    })
  }
}

/**
 * Check if an assistant message already exists
 */
export function assistantMessageExists(sessionId: string, runId: string): boolean {
  try {
    const db = getDatabase()
    const existing = db.prepare(
      `SELECT id FROM chat_messages
       WHERE session_id = ?
         AND role = 'assistant'
         AND json_extract(metadata, '$.runId') = ?
       LIMIT 1`
    ).get(sessionId, runId)

    return !!existing
  } catch {
    return false
  }
}

/**
 * Persist an assistant final message
 */
export function persistAssistantMessage(
  sessionId: string,
  runId: string,
  messageText: string
): void {
  // Skip empty messages
  if (!messageText || !messageText.trim()) {
    return
  }

  // Check for duplicates
  if (assistantMessageExists(sessionId, runId)) {
    return
  }

  persistMessage({
    sessionId,
    content: messageText,
    role: 'assistant',
    runId,
    source: 'instance-bridge'
  })
}
