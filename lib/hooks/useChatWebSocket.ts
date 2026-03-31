import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, MCPActivity } from '@/lib/db/schema'

export type WSEvent =
  | { type: 'message.chunk'; sessionId: string; chunk: string }
  | { type: 'message.complete'; sessionId: string; message: ChatMessage }
  | { type: 'typing.start'; sessionId: string; agentName: string }
  | { type: 'typing.stop'; sessionId: string }
  | { type: 'mcp.start'; sessionId: string; tool: string; action: string }
  | { type: 'mcp.complete'; sessionId: string }
  | { type: 'session.status'; sessionId: string; status: string }
  // Extended events for enhanced chat
  | { type: 'chat'; sessionId?: string; data?: any }  // OpenClaw gateway chat events
  | { type: 'agent'; sessionId?: string; data?: any } // OpenClaw agent events
  // New instance bridge events
  | { type: 'connected'; clientId: string; capabilities?: { instanceBridge: boolean } }
  | { type: 'chat.delta'; sessionId: string; runId: string; seq: number; delta: string }
  | { type: 'chat.final'; sessionId: string; runId: string; seq: number; message: ChatMessage }
  | { type: 'chat.error'; sessionId: string; runId: string; seq: number; error: string }
  | { type: 'agent.typing'; sessionId: string; agentId: string; isTyping: boolean }
  | { type: 'state.changed'; sessionId: string; state: string; error?: string }
  | { type: 'error'; sessionId?: string; error: string }

interface UseChatWebSocketOptions {
  sessionId?: string
  agentId?: string
  onMessage?: (event: WSEvent) => void
  enabled?: boolean
  useInstanceBridge?: boolean  // New: Use gateway session instance bridge
}

const MAX_RETRIES = 5
const RETRY_DELAY = 2000

export function useChatWebSocket({ 
  sessionId, 
  agentId,
  onMessage, 
  enabled = true,
  useInstanceBridge = false
}: UseChatWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [instanceState, setInstanceState] = useState<string | null>(null)
  const [currentSeq, setCurrentSeq] = useState<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const authWarningShownRef = useRef(false)
  
  // Use refs to store latest values without causing re-renders
  const sessionIdRef = useRef(sessionId)
  const agentIdRef = useRef(agentId)
  const onMessageRef = useRef(onMessage)
  const enabledRef = useRef(enabled)
  const useInstanceBridgeRef = useRef(useInstanceBridge)
  const savedSeqRef = useRef<number>(0)

  // Update refs when values change
  useEffect(() => {
    sessionIdRef.current = sessionId
    agentIdRef.current = agentId
    onMessageRef.current = onMessage
    enabledRef.current = enabled
    useInstanceBridgeRef.current = useInstanceBridge
  }, [sessionId, agentId, onMessage, enabled, useInstanceBridge])

  // Save sequence number for reconnection
  useEffect(() => {
    savedSeqRef.current = currentSeq
  }, [currentSeq])

  const connect = () => {
    const currentEnabled = enabledRef.current
    const currentIsConnecting = isConnecting
    
    if (!currentEnabled || currentIsConnecting || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setIsConnecting(true)

    try {
      // Create WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/chat/ws`
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        setIsConnected(true)
        setIsConnecting(false)
        retriesRef.current = 0

        // Subscribe to gateway session instance if using bridge
        const currentUseInstanceBridge = useInstanceBridgeRef.current
        const currentSessionId = sessionIdRef.current
        const currentAgentId = agentIdRef.current

        if (currentUseInstanceBridge && currentSessionId && currentAgentId) {
          // Connect to the gateway session instance with sequence resume
          ws.send(JSON.stringify({
            type: 'instance.subscribe',
            sessionId: currentSessionId,
            agentId: currentAgentId,
            sinceSeq: savedSeqRef.current
          }))
          console.log('[WebSocket] Subscribed to instance', {
            sessionId: currentSessionId,
            agentId: currentAgentId,
            sinceSeq: savedSeqRef.current
          })
        } else if (currentSessionId) {
          // Legacy subscription
          ws.send(JSON.stringify({ type: 'subscribe', sessionId: currentSessionId }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSEvent
          
          // Handle instance bridge events
          if (data.type === 'chat.delta') {
            setCurrentSeq(data.seq)
          } else if (data.type === 'chat.final') {
            setCurrentSeq(data.seq)
          } else if (data.type === 'chat.error') {
            setCurrentSeq(data.seq)
          } else if (data.type === 'state.changed') {
            setInstanceState(data.state)
          }

          // Use ref to get latest onMessage callback
          onMessageRef.current?.(data)
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
      }

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        setIsConnected(false)
        setIsConnecting(false)
        setInstanceState(null)
        wsRef.current = null

        // Attempt reconnection
        if (enabledRef.current && retriesRef.current < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, retriesRef.current)
          console.log(`[WebSocket] Reconnecting in ${delay}ms...`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            retriesRef.current++
            connect()
          }, delay)
        }
      }
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error)
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (wsRef.current) {
      // Unsubscribe from instance if using bridge
      if (useInstanceBridgeRef.current && sessionIdRef.current) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'instance.unsubscribe',
            sessionId: sessionIdRef.current
          }))
        } catch {
          // Ignore errors during cleanup
        }
      }
      
      wsRef.current.close()
      wsRef.current = null
    }
    
    setIsConnected(false)
    setIsConnecting(false)
    setInstanceState(null)
  }

  const subscribe = (newSessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (useInstanceBridgeRef.current && agentIdRef.current) {
        // Subscribe to instance
        wsRef.current.send(JSON.stringify({
          type: 'instance.subscribe',
          sessionId: newSessionId,
          agentId: agentIdRef.current,
          sinceSeq: savedSeqRef.current
        }))
      } else {
        // Legacy subscription
        wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: newSessionId }))
      }
    }
  }

  const unsubscribe = (oldSessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (useInstanceBridgeRef.current) {
        // Unsubscribe from instance
        wsRef.current.send(JSON.stringify({
          type: 'instance.unsubscribe',
          sessionId: oldSessionId
        }))
      } else {
        // Legacy unsubscribe
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', sessionId: oldSessionId }))
      }
    }
  }

  const sendTyping = (typingSessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'user.typing', sessionId: typingSessionId }))
    }
  }

  // New: Send chat message through instance bridge
  const sendChatMessage = (content: string, options?: Record<string, unknown>): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat.send',
        sessionId: sessionIdRef.current,
        content,
        options
      }))
      return true
    }

    return false
  }

  // New: Abort chat through instance bridge
  const abortChat = (runId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat.abort',
        sessionId: sessionIdRef.current,
        runId
      }))
    }
  }

  // Connect on mount and when enabled changes
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [enabled]) // Only depend on enabled, use refs for other values
  
  // Subscribe to session changes
  useEffect(() => {
    if (sessionId && isConnected) {
      subscribe(sessionId)
    }

    return () => {
      if (sessionId && isConnected) {
        unsubscribe(sessionId)
      }
    }
  }, [sessionId, isConnected])
  
  return {
    isConnected,
    isConnecting,
    instanceState,
    currentSeq,
    subscribe,
    unsubscribe,
    sendTyping,
    reconnect: connect,
    sendChatMessage,
    abortChat,
  }
}
