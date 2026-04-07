/**
 * Gateway Session Connection Management
 * 
 * Handles WebSocket connection lifecycle to the gateway.
 */

import WebSocket from 'ws'
export interface ConnectionCallbacks {
  onOpen: () => void
  onMessage: (data: WebSocket.Data) => void
  onClose: () => void
  onError: (error: Error) => void
}

/**
 * Determine the appropriate origin header for gateway connections
 */
export function determineOrigin(gatewayUrl: string): string {
  // Use environment variable if set
  if (process.env.CLAWHUB_ORIGIN) {
    return process.env.CLAWHUB_ORIGIN
  }

  // Parse gateway URL to construct matching origin
  const parsedUrl = new URL(gatewayUrl)
  const protocol = parsedUrl.protocol === 'wss:' ? 'https:' : 'http:'

  // If connecting to localhost, use localhost origin
  if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
    return `${protocol}//localhost:18789`
  }

  // For remote connections, use the gateway host
  return `${protocol}//${parsedUrl.host}`
}

/**
 * Create and configure a gateway WebSocket connection
 */
export function createGatewayConnection(
  gatewayUrl: string,
  origin: string,
  callbacks: ConnectionCallbacks,
  connectTimeoutMs = 10000
): { ws: WebSocket; timeout: ReturnType<typeof setTimeout> } {
  const ws = new WebSocket(gatewayUrl, {
    maxPayload: 25 * 1024 * 1024,
    headers: {
      'Origin': origin
    }
  })

  const timeout = setTimeout(() => {
    callbacks.onError(new Error('Gateway connection timeout (10s)'))
    ws.close()
  }, connectTimeoutMs)

  ws.on('open', () => {
    callbacks.onOpen()
  })

  ws.on('message', (data: WebSocket.Data) => {
    callbacks.onMessage(data)
  })

  ws.on('close', () => {
    callbacks.onClose()
  })

  ws.on('error', (err) => {
    clearTimeout(timeout)
    callbacks.onError(err)
  })

  return { ws, timeout }
}

/**
 * Close a WebSocket connection gracefully
 */
export function closeConnection(ws: WebSocket | null): void {
  if (ws) {
    ws.close()
  }
}

/**
 * Check if WebSocket is in open state
 */
export function isConnectionOpen(ws: WebSocket | null): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN
}
