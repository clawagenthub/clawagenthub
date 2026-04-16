import { NextRequest } from 'next/server'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import { getWebSocketManager } from '@/lib/websocket/manager'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace } from '@/lib/auth/api-auth'
import { getSessionStatusTracker } from '@/lib/session/status-tracker'
import { getInstanceManager } from '@/lib/gateway/instance-manager'
import logger from '@/lib/logger/index.js'

// WebSocket server instance
let wss: WebSocketServer | null = null

function getWSS(): WebSocketServer {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true })
    logger.debug('[WebSocket] Server initialized', { initialized: true })
  }
  return wss
}

export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get('upgrade')
  const connectionHeader = request.headers.get('connection')
  const hostHeader = request.headers.get('host')
  const originHeader = request.headers.get('origin')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const wsKeyHeader = request.headers.get('sec-websocket-key')
  const wsVersionHeader = request.headers.get('sec-websocket-version')
  const wsProtocolHeader = request.headers.get('sec-websocket-protocol')

  logger.debug('[WebSocket] Incoming upgrade request', {
    method: request.method,
    url: request.url,
    upgrade: upgradeHeader,
    connection: connectionHeader,
    host: hostHeader,
    origin: originHeader,
    forwardedProto,
    forwardedHost,
    wsVersion: wsVersionHeader,
    hasWsKey: Boolean(wsKeyHeader),
    wsProtocol: wsProtocolHeader || '(none)',
  })

  if (upgradeHeader !== 'websocket') {
    logger.warn('[WebSocket] Rejecting non-websocket upgrade request', {
      upgrade: upgradeHeader,
      connection: connectionHeader,
      url: request.url,
    })
    return new Response('Expected WebSocket', { status: 426 })
  }

  try {
    // Verify user session from httpOnly cookie via server-side auth utility
    const auth = await getUserWithWorkspace()
    if (!auth) {
      logger.warn('[WebSocket] Unauthorized websocket request', {
        host: hostHeader,
        origin: originHeader,
        url: request.url,
      })
      return new Response('Unauthorized', { status: 401 })
    }

    // Get the raw socket from the request
    const socket = (request as any).socket
    const head = (request as any).head || Buffer.alloc(0)

    if (!socket) {
      return new Response('No socket available', { status: 500 })
    }

    const wss = getWSS()
    const manager = getWebSocketManager()
    const instanceManager = getInstanceManager()

    // Upgrade the connection
    wss.handleUpgrade(request as any, socket, head, async (ws: WebSocket) => {
      const clientId = randomUUID()

      logger.debug('[WebSocket] Upgrade completed', {
        clientId,
        userId: auth.user.id,
        socketRemoteAddress: (socket as any).remoteAddress || '(unknown)',
        socketRemotePort: (socket as any).remotePort || '(unknown)',
      })

      // Add client to manager
      manager.addClient(clientId, ws, auth.user.id)

      // Track client subscriptions for cleanup
      const clientSubscriptions = new Set<string>()
      let subscribedToSessions = false
      let instanceSessionId: string | null = null

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())

          switch (message.type) {
            case 'subscribe':
              if (message.channel === 'sessions') {
                // Subscribe to global session status updates
                if (!subscribedToSessions) {
                  manager.subscribe(clientId, 'sessions')
                  subscribedToSessions = true

                  // Send initial batch of all session statuses
                  const statusTracker = getSessionStatusTracker()
                  const allStatuses = statusTracker.getAllStatuses()
                  ws.send(
                    JSON.stringify({
                      type: 'session.statuses',
                      data: allStatuses,
                    })
                  )

                  logger.debug(
                    '[WebSocket] Client subscribed to sessions channel:',
                    clientId
                  )
                }
              } else if (message.sessionId) {
                // Verify user has access to session
                const db = getDatabase()
                const session = db
                  .prepare(
                    'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?'
                  )
                  .get(message.sessionId, auth.user.id)

                if (session) {
                  manager.subscribe(clientId, message.sessionId)
                  clientSubscriptions.add(message.sessionId)
                }
              }
              break

            // NEW: Connect to a gateway session instance
            case 'instance.subscribe': {
              const { sessionId, agentId, sinceSeq } = message

              // Verify user has access to session
              const db = getDatabase()
              const session = db
                .prepare(
                  'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?'
                )
                .get(sessionId, auth.user.id) as
                | { id: string; session_key: string }
                | undefined

              if (!session) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error: 'Session not found or access denied',
                  })
                )
                break
              }

              // Add client to instance (creates instance if needed)
              try {
                await instanceManager.addClient(clientId, ws, auth.user.id, {
                  sessionId,
                  agentId,
                  sessionKey: session.session_key,
                  sinceSeq,
                })

                instanceSessionId = sessionId
                logger.debug('[WebSocket] Client connected to instance', {
                  clientId,
                  sessionId,
                  agentId,
                })
              } catch (error) {
                logger.error(
                  '[WebSocket] Failed to connect to instance:',
                  error
                )
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error:
                      error instanceof Error
                        ? error.message
                        : 'Failed to connect to gateway',
                  })
                )
              }
              break
            }

            // NEW: Disconnect from gateway session instance
            case 'instance.unsubscribe': {
              if (instanceSessionId) {
                instanceManager.removeClient(clientId)
                instanceSessionId = null
              }
              break
            }

            // NEW: Forward chat messages to instance
            case 'chat.send':
            case 'chat.abort': {
              if (instanceSessionId) {
                await instanceManager.handleClientMessage(clientId, message)
              } else {
                // Fallback to old behavior
                logger.warn(
                  '[WebSocket] Chat message without instance subscription',
                  { clientId }
                )
              }
              break
            }

            case 'unsubscribe':
              if (message.channel === 'sessions') {
                if (subscribedToSessions) {
                  manager.unsubscribe(clientId, 'sessions')
                  subscribedToSessions = false
                }
              } else if (message.sessionId) {
                manager.unsubscribe(clientId, message.sessionId)
                clientSubscriptions.delete(message.sessionId)
              }
              break

            case 'user.typing':
              if (message.sessionId) {
                // Broadcast typing indicator to other clients
                manager.broadcast(message.sessionId, {
                  type: 'user.typing',
                  sessionId: message.sessionId,
                  userId: auth.user.id,
                })
              }
              break

            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }))
              break
          }
        } catch (error) {
          logger.error('[WebSocket] Message handling error:', error)
        }
      })

      // Handle disconnection
      ws.on('close', (code: number, reason: Buffer) => {
        // Unsubscribe from all channels
        for (const sessionId of clientSubscriptions) {
          manager.unsubscribe(clientId, sessionId)
        }
        if (subscribedToSessions) {
          manager.unsubscribe(clientId, 'sessions')
        }

        // Remove from instance if connected
        if (instanceSessionId) {
          instanceManager.removeClient(clientId)
        }

        manager.removeClient(clientId)
        logger.debug('[WebSocket] Client disconnected', {
          clientId,
          code,
          reason: reason?.toString?.() || '(none)',
          subscribedToSessions,
          channelSubscriptions: clientSubscriptions.size,
          hadInstanceSession: Boolean(instanceSessionId),
        })
      })

      // Handle errors
      ws.on('error', (error) => {
        logger.error('[WebSocket] Client error', {
          clientId,
          error,
          subscribedToSessions,
          channelSubscriptions: clientSubscriptions.size,
          instanceSessionId,
        })
        manager.removeClient(clientId)

        // Remove from instance if connected
        if (instanceSessionId) {
          instanceManager.removeClient(clientId)
        }
      })

      // Send connection confirmation
      ws.send(
        JSON.stringify({
          type: 'connected',
          clientId,
          capabilities: {
            instanceBridge: true, // Indicate support for instance bridging
          },
        })
      )
    })

    // Return empty response (connection is upgraded)
    return new Response(null, { status: 101 })
  } catch (error) {
    logger.error('[WebSocket] Connection error', {
      error,
      url: request.url,
      host: hostHeader,
      origin: originHeader,
      forwardedProto,
      forwardedHost,
    })
    return new Response('Internal Server Error', { status: 500 })
  }
}
