import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/db'
import type { ChatContentBlock } from '@/lib/db/schema'
import logger from "@/lib/logger/index.js"

/**
 * Check if a model supports image/vision input
 */
export function modelHasImageRecognition(model: unknown): boolean {
  if (!model) return false

  // Handle case where model is an object like { primary: 'minimax/MiniMax-M2.7' }
  let modelStr: string
  if (typeof model === 'object' && model !== null) {
    // Try to extract the primary model string from object
    const modelObj = model as Record<string, unknown>
    if (typeof modelObj.primary === 'string') {
      modelStr = modelObj.primary.toLowerCase()
    } else if (typeof modelObj.model === 'string') {
      modelStr = modelObj.model.toLowerCase()
    } else if (typeof modelObj.id === 'string') {
      modelStr = modelObj.id.toLowerCase()
    } else {
      // Fallback: stringify the object and hope for the best
      modelStr = JSON.stringify(model).toLowerCase()
    }
  } else {
    modelStr = String(model).toLowerCase()
  }

  const indicators = [
    'vision',
    'vl-',
    'gpt-4v',
    'gpt-4-vision',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-5',
    'multimodal',
    'gemma3',
    'pixtral',
    'mistral-large',
    'commandr+',
    'gemini',
    'gpt-4.1',
    'gpt-4o',
    'claude-sonnet',
    'claude-opus',
    'haiku',
    'minimax-m2',
    'minimax-m2.7',
    'minimax-m1',
    'minimax',
  ]
  return indicators.some((indicator) => modelStr.includes(indicator))
}

export function persistAssistantFinalMessage(
  sessionId: string,
  runId: string,
  message: unknown
): void {
  try {
    const db = getDatabase()
    const now = new Date().toISOString()

    const existing = db
      .prepare(
        `SELECT id FROM chat_messages
         WHERE session_id = ?
           AND role = 'assistant'
           AND json_extract(metadata, '$.runId') = ?
         LIMIT 1`
      )
      .get(sessionId, runId) as { id: string } | undefined

    if (existing) return

    let assistantText = ''
    const agentMsg = message as any

    if (typeof agentMsg?.content === 'string') {
      assistantText = agentMsg.content
    } else if (Array.isArray(agentMsg?.content)) {
      assistantText = agentMsg.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n')
    }

    if (!assistantText.trim()) return

    const assistantContentBlocks: ChatContentBlock[] = [
      { type: 'text', text: assistantText },
    ]

    db.prepare(
      `INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?)`
    ).run(
      randomUUID(),
      sessionId,
      JSON.stringify(assistantContentBlocks),
      JSON.stringify({ runId, source: 'http-stream' }),
      now
    )

    db.prepare(
      `UPDATE chat_sessions
       SET status = 'active', last_activity_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(now, now, sessionId)
  } catch (error) {
    logger.error('[Chat API] Failed to persist assistant final message:', {
      sessionId,
      runId,
      error,
    })
  }
}
