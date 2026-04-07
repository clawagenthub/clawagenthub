import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import { storeAttachments, type StoredAttachmentInput } from '@/lib/attachments'
import type { ChatMessage, ChatContentBlock } from '@/lib/db/schema'

/**
 * Check if a model supports image/vision input
 */
function modelHasImageRecognition(model: unknown): boolean {
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

function persistAssistantFinalMessage(
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
    console.error('[Chat API] Failed to persist assistant final message:', {
      sessionId,
      runId,
      error,
    })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase()
    const sessionId = params.id

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    // Verify chat session belongs to user's workspace
    const chatSession = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(sessionId, auth.workspaceId) as { id: string } | undefined

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      )
    }

    // Get all messages for this session
    const messages = db
      .prepare(
        `
        SELECT * FROM chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `
      )
      .all(sessionId) as ChatMessage[]

    // Parse JSON content for each message
    const parsedMessages = messages.map((msg) => ({
      ...msg,
      content: JSON.parse(msg.content),
      metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
    }))

    return NextResponse.json({ messages: parsedMessages })
  } catch (error) {
    console.error('[Chat API] Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase()
    const manager = getGatewayManager()
    const sessionId = params.id
    const body = await request.json()
    const { content, attachments = [], stream = false } = body

    // Allow image-only messages (text optional when attachments provided)
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0
    if (!content && !hasAttachments) {
      return NextResponse.json(
        { error: 'Missing content and attachments' },
        { status: 400 }
      )
    }

    // Use global auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    // Get chat session with gateway info
    const chatSession = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ? AND workspace_id = ?')
      .get(sessionId, auth.workspaceId) as
      | {
          id: string
          gateway_id: string
          session_key: string
        }
      | undefined

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      )
    }

    // Send message to agent via gateway
    const client = manager.getClient(chatSession.gateway_id)
    if (!client || !client.isConnected()) {
      return NextResponse.json(
        { error: 'Gateway not connected' },
        { status: 503 }
      )
    }

    // NOTE: Agent capability detection has been removed.
    // We now let the gateway handle image fallback automatically.
    // The gateway has built-in imageModel fallback support that should be used.

    // Generate run ID for tracking this message
    const runId = randomUUID()
    const now = new Date().toISOString()

    // *** CRITICAL FIX: Save user message to database IMMEDIATELY in both modes ***
    // This ensures messages are never lost if user navigates away
    const userMessageId = randomUUID()

    // DO NOT pre-filter image attachments based on agent capability detection.
    // The gateway has built-in fallback handling (imageModel) that should be allowed to process
    // images even when the session model doesn't natively support vision.
    // Pre-filtering here prevents the gateway from ever using its fallback path.
    const normalizedAttachments = Array.isArray(attachments)
      ? (attachments.map((attachment: any) => ({
          name: String(attachment?.name || 'attachment'),
          mimeType: String(attachment?.mimeType || 'application/octet-stream'),
          size: Number(attachment?.size || 0),
          kind:
            attachment?.kind === 'image' || attachment?.kind === 'pdf'
              ? attachment.kind
              : 'file',
          dataBase64: String(attachment?.dataBase64 || ''),
        })) as StoredAttachmentInput[])
      : []

    // Allow image-only messages - gateway will handle fallback or return appropriate error
    // Don't block here since the gateway knows how to handle non-vision models with images
    const hasContent =
      content.trim().length > 0 || normalizedAttachments.length > 0
    if (!hasContent) {
      return NextResponse.json(
        { error: 'Missing content and attachments' },
        { status: 400 }
      )
    }

    const storedAttachments =
      normalizedAttachments.length > 0
        ? await storeAttachments(normalizedAttachments)
        : []

    const contentBlocks: ChatContentBlock[] = [
      { type: 'text', text: content },
      ...storedAttachments.map((attachment) =>
        attachment.kind === 'image'
          ? {
              type: 'image' as const,
              imageUrl: attachment.url,
              fileName: attachment.name,
              mimeType: attachment.mimeType,
            }
          : {
              type: 'file' as const,
              fileUrl: attachment.url,
              fileName: attachment.name,
              mimeType: attachment.mimeType,
            }
      ),
    ]

    db.prepare(
      `
      INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
      userMessageId,
      sessionId,
      'user',
      JSON.stringify(contentBlocks),
      null,
      now
    )

    console.log('[Chat API] User message saved to database:', userMessageId)

    // Update session last activity
    db.prepare(
      `
      UPDATE chat_sessions
      SET last_activity_at = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(now, now, sessionId)

    // STREAMING MODE: Return immediately after queuing the message
    if (stream) {
      console.log('[Chat API] Streaming mode: queuing message', {
        sessionId,
        runId,
      })

      // Send message without waiting for response (deliver=false)
      try {
        const outboundContent =
          storedAttachments.length > 0
            ? `${content}${content ? '\n\n' : ''}${storedAttachments.map((attachment) => `${attachment.kind === 'image' ? 'Image' : 'Attachment'}: ${attachment.url}`).join('\n')}`
            : content

        await client.sendChatMessage(chatSession.session_key, outboundContent, {
          deliver: false, // Don't wait for delivery
          idempotencyKey: runId,
        })

        // Persist assistant final in the background for HTTP streaming fallback path.
        // This ensures reconnect/polling still sees the assistant message in DB.
        const unsubscribe = client.onEvent('chat', (event: any) => {
          const payload = event?.payload || event

          if (!payload || payload.runId !== runId) return

          if (payload.state === 'final' && payload.message) {
            persistAssistantFinalMessage(sessionId, runId, payload.message)
            unsubscribe()
          } else if (payload.state === 'error') {
            unsubscribe()
          }
        })

        // Safety cleanup to avoid listener leak if final event never arrives.
        setTimeout(
          () => {
            try {
              unsubscribe()
            } catch {
              // noop
            }
          },
          5 * 60 * 1000
        )
      } catch (error) {
        console.error('[Chat API] Error queuing message to agent:', error)
        // Message was already saved, so return success even if queuing fails
        return NextResponse.json(
          {
            runId,
            status: 'queued',
            message: 'Message saved but agent may not receive it',
          },
          { status: 202 }
        )
      }

      // Return immediately with runId for tracking and the saved message
      return NextResponse.json(
        {
          runId,
          status: 'queued',
          message: {
            id: userMessageId,
            session_id: sessionId,
            role: 'user',
            content: JSON.stringify(contentBlocks),
            created_at: now,
          },
        },
        { status: 202 }
      ) // 202 Accepted
    }

    // LEGACY MODE: Wait for full response (backward compatible)
    console.log('[Chat API] Legacy mode: waiting for response', { sessionId })
    // User message already saved above

    try {
      // Send message using chat.send (OpenClaw v3.2+)
      const outboundContent =
        storedAttachments.length > 0
          ? `${content}${content ? '\n\n' : ''}${storedAttachments.map((attachment) => `${attachment.kind === 'image' ? 'Image' : 'Attachment'}: ${attachment.url}`).join('\n')}`
          : content

      const result = await client.sendChatMessageAndWait(
        chatSession.session_key,
        outboundContent
      )

      if (result.error) {
        console.error('[Chat API] Agent returned error:', result.error)
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      // Save agent response to database if we got one
      let assistantMessage: ChatMessage | null = null
      if (result.message) {
        const assistantMessageId = randomUUID()
        const assistantNow = new Date().toISOString()

        // Extract text from agent response
        let assistantText = ''
        const agentMsg = result.message as any

        if (typeof agentMsg.content === 'string') {
          assistantText = agentMsg.content
        } else if (Array.isArray(agentMsg.content)) {
          // Extract text from content blocks
          assistantText = agentMsg.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n')
        }

        if (assistantText) {
          const assistantContentBlocks: ChatContentBlock[] = [
            { type: 'text', text: assistantText },
          ]

          db.prepare(
            `
            INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `
          ).run(
            assistantMessageId,
            sessionId,
            'assistant',
            JSON.stringify(assistantContentBlocks),
            null,
            assistantNow
          )

          assistantMessage = {
            id: assistantMessageId,
            session_id: sessionId,
            role: 'assistant',
            content: JSON.stringify(assistantContentBlocks),
            metadata: null,
            created_at: assistantNow,
          }
        }
      }

      // Update session timestamp and mark as active
      db.prepare(
        `
        UPDATE chat_sessions
        SET status = 'active', last_activity_at = ?, updated_at = ?
        WHERE id = ?
      `
      ).run(now, now, sessionId)

      const userMessage: ChatMessage = {
        id: userMessageId,
        session_id: sessionId,
        role: 'user',
        content: JSON.stringify(contentBlocks),
        metadata: null,
        created_at: now,
      }

      return NextResponse.json({
        message: userMessage,
        assistantMessage,
        runId: result.runId,
      })
    } catch (error) {
      console.error('[Chat API] Error sending message to agent:', error)
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to send message to agent',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Chat API] Error processing message:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}
