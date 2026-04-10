

export interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

export function createWebSocketConnection() {
  let ws: WebSocket | null = null
  let retries = 0
  let reconnectTimeout: ReturnType<typeof setTimeout> | undefined
  const savedSeqRef = { current: 0 }
  const sessionIdRef = { current: undefined as string | undefined }
  const agentIdRef = { current: undefined as string | undefined }
  const instanceBridgeRef = { current: false }
  const onMessageRef = { current: undefined as ((event: WebSocketMessage) => void) | undefined }
  const enabledRef = { current: true }

  function setMessageHandler(handler: (event: WebSocketMessage) => void) { onMessageRef.current = handler }
  function setEnabled(enabled: boolean) { enabledRef.current = enabled }
  function setSessionInfo(sessionId?: string, agentId?: string, instanceBridge?: boolean) {
    sessionIdRef.current = sessionId; agentIdRef.current = agentId
    if (instanceBridge !== undefined) instanceBridgeRef.current = instanceBridge
  }
  function setSavedSeq(seq: number) { savedSeqRef.current = seq }

  function connect(
    onMessage: (event: WebSocketMessage) => void,
    enabled: boolean,
    maxRetries = 5,
    retryDelay = 2000,
    isConnecting: boolean,
    setIsConnecting: (v: boolean) => void,
    setIsConnected: (v: boolean) => void,
    setInstanceState: (v: string | null) => void,
    setCurrentSeq: (v: number) => void
  ) {
    if (!enabled || isConnecting || ws?.readyState === WebSocket.OPEN) return
    setIsConnecting(true)
    onMessageRef.current = onMessage

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/chat/ws`)
      ws = socket

      socket.onopen = () => {
        console.info('[WebSocket] Connected')
        setIsConnected(true); setIsConnecting(false); retries = 0
        const sessionId = sessionIdRef.current; const agentId = agentIdRef.current
        if (instanceBridgeRef.current && sessionId && agentId) {
          socket.send(JSON.stringify({ type: 'instance.subscribe', sessionId, agentId, sinceSeq: savedSeqRef.current }))
        } else if (sessionId) { socket.send(JSON.stringify({ type: 'subscribe', sessionId })) }
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage
          if (data.type === 'chat.delta') setCurrentSeq((data as any).seq)
          else if (data.type === 'chat.final') setCurrentSeq((data as any).seq)
          else if (data.type === 'chat.error') setCurrentSeq((data as any).seq)
          else if (data.type === 'state.changed') setInstanceState((data as any).state)
          onMessageRef.current?.(data)
        } catch (error) { console.error('[WebSocket] Failed to parse message:', error) }
      }

      socket.onerror = (error) => { console.error('[WebSocket] Error:', error) }

      socket.onclose = () => {
        console.warn('[WebSocket] Disconnected')
        setIsConnected(false); setIsConnecting(false); setInstanceState(null); ws = null
        if (enabledRef.current && retries < maxRetries) {
          reconnectTimeout = setTimeout(() => { retries++; connect(onMessageRef.current!, enabledRef.current, maxRetries, retryDelay, false, setIsConnecting, setIsConnected, setInstanceState, setCurrentSeq) }, retryDelay * Math.pow(2, retries))
        }
      }
    } catch (error) { console.error('[WebSocket] Connection failed:', error); setIsConnecting(false) }
  }

  function disconnect() {
    if (reconnectTimeout) clearTimeout(reconnectTimeout)
    if (ws) {
      if (instanceBridgeRef.current && sessionIdRef.current) {
        try { ws.send(JSON.stringify({ type: 'instance.unsubscribe', sessionId: sessionIdRef.current })) } catch { /* ignore */ }
      }
      ws.close(); ws = null
    }
  }

  function subscribe(sessionId: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      if (instanceBridgeRef.current && agentIdRef.current) {
        ws.send(JSON.stringify({ type: 'instance.subscribe', sessionId, agentId: agentIdRef.current, sinceSeq: savedSeqRef.current }))
      } else { ws.send(JSON.stringify({ type: 'subscribe', sessionId })) }
    }
  }

  function unsubscribe(sessionId: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      if (instanceBridgeRef.current) { ws.send(JSON.stringify({ type: 'instance.unsubscribe', sessionId })) }
      else { ws.send(JSON.stringify({ type: 'unsubscribe', sessionId })) }
    }
  }

  function sendTyping(typingSessionId: string) {
    if (ws?.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: 'user.typing', sessionId: typingSessionId })) }
  }

  function sendChatMessage(content: string, options?: Record<string, unknown>) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat.send', sessionId: sessionIdRef.current, content, options }))
      return true
    }
    return false
  }

  function abortChat(runId: string) {
    if (ws?.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: 'chat.abort', sessionId: sessionIdRef.current, runId })) }
  }

  function cleanup() {
    if (reconnectTimeout) clearTimeout(reconnectTimeout)
    if (ws) ws.close(); ws = null
  }

  return { connect, disconnect, subscribe, unsubscribe, sendTyping, sendChatMessage, abortChat, cleanup, setMessageHandler, setEnabled, setSessionInfo, setSavedSeq, getSavedSeq: () => savedSeqRef.current }
}

export type WebSocketConnection = ReturnType<typeof createWebSocketConnection>