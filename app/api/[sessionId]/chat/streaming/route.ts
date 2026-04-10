import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session/verify'
import { getStreamingChatService } from '@/lib/streaming/chat-service'
import logger from "@/lib/logger/index.js"

/**
 * POST /api/{sessionId}/chat/streaming
 * Start streaming for a chat session (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
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

    const workspaceId = verification.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { sessionId: chatSessionId } = body

    if (!chatSessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    logger.debug('[Streaming API] Starting stream for session:', chatSessionId)

    const service = getStreamingChatService()
    const result = await service.startStreaming({
      sessionId: chatSessionId,
      userId: verification.user.id,
      workspaceId
    })

    logger.debug('[Streaming API] Stream started:', result)
    return NextResponse.json(result)
  } catch (error) {
    logger.error('[Streaming API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start streaming' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/{sessionId}/chat/streaming
 * Get status of all active streaming sessions for the current user (session-scoped)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
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

    const service = getStreamingChatService()
    const streams = service.getActiveStreams(verification.user.id)

    return NextResponse.json({ streams })
  } catch (error) {
    logger.error('[Streaming API] Error:', error)
    return NextResponse.json({ streams: [] })
  }
}

/**
 * DELETE /api/{sessionId}/chat/streaming?streamId=xxx
 * Stop streaming for a session (session-scoped)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
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

    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('streamId')

    if (!streamId) {
      return NextResponse.json({ error: 'Missing streamId' }, { status: 400 })
    }

    const service = getStreamingChatService()
    
    // Verify ownership
    const stream = service.getStream(streamId)
    if (!stream || stream.userId !== verification.user.id) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
    }

    logger.debug('[Streaming API] Stopping stream:', streamId)
    service.stopStreaming(streamId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Streaming API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to stop streaming' },
      { status: 500 }
    )
  }
}
