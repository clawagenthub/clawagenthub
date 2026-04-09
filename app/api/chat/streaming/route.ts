import { NextResponse } from 'next/server'
import { getStreamingChatService } from '@/lib/streaming/chat-service'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import logger, { logCategories } from '@/lib/logger/index.js'


/**
 * POST /api/chat/streaming
 * Start streaming for a chat session
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    logger.debug('[Streaming API] Starting stream for session:', sessionId)

    const service = getStreamingChatService()
    const result = await service.startStreaming({
      sessionId,
      userId: auth.user.id,
      workspaceId: auth.workspaceId
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
 * GET /api/chat/streaming
 * Get status of all active streaming sessions for the current user
 */
export async function GET(request: Request) {
  try {
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    const service = getStreamingChatService()
    const streams = service.getActiveStreams(auth.user.id)

    return NextResponse.json({ streams })
  } catch (error) {
    logger.error('[Streaming API] Error:', error)
    return NextResponse.json({ streams: [] })
  }
}

/**
 * DELETE /api/chat/streaming?streamId=xxx
 * Stop streaming for a session
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('streamId')

    if (!streamId) {
      return NextResponse.json({ error: 'Missing streamId' }, { status: 400 })
    }

    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse()
    }

    const service = getStreamingChatService()
    
    // Verify ownership
    const stream = service.getStream(streamId)
    if (!stream || stream.userId !== auth.user.id) {
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
