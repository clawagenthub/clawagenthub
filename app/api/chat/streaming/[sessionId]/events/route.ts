import { NextRequest } from 'next/server'
import { getStreamingChatService } from '@/lib/streaming/chat-service'
import { getUserWithWorkspace } from '@/lib/auth/api-auth'
import logger, { logCategories } from '@/lib/logger/index.js'


/**
 * GET /api/chat/streaming/[sessionId]/events
 * SSE endpoint for receiving streaming events
 * Supports reconnection to active streams
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId

  const auth = await getUserWithWorkspace()
  if (!auth) {
    return new Response('Unauthorized', { status: 401 })
  }

  const service = getStreamingChatService()

  // Check if there's an active stream
  const streamId = service.getStreamId(sessionId)
  
  if (!streamId) {
    // No active stream, but still check if user has access to the session
    return new Response(JSON.stringify({ 
      message: 'No active stream for this session',
      sessionId 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Verify ownership
  const stream = service.getStream(streamId)
  if (!stream || stream.userId !== auth.user.id) {
    return new Response('Stream not found', { status: 404 })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  
  const streamResponse = new ReadableStream({
    start(controller) {
      logger.debug('[Streaming Events] Client connected to stream:', streamId)

      // Send buffered events first
      const bufferedEvents = service.getBufferedEvents(streamId)
      logger.debug('[Streaming Events] Sending', bufferedEvents.length, 'buffered events')
      
      for (const event of bufferedEvents) {
        const sseData = `data: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(sseData))
      }

      // Send a "caught up" message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'caught.up', bufferedEvents: bufferedEvents.length })}\n\n`))

      // For a full SSE implementation, we would keep the connection open
      // and push new events as they arrive. For now, we send buffered events
      // and close, as real-time events are sent via WebSocket.
      
      // In a production SSE implementation, you would:
      // 1. Subscribe to the stream's events
      // 2. Push new events to the controller
      // 3. Handle client disconnect
      // 4. Keep connection alive with keep-alive comments
      
      setTimeout(() => {
        controller.close()
        logger.debug('[Streaming Events] Client disconnected from stream:', streamId)
      }, 100)
    }
  })

  return new Response(streamResponse, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': '*'
    }
  })
}
