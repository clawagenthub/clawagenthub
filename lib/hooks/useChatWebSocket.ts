import { useEffect, useRef, useState } from 'react'
import { createWebSocketConnection, type WebSocketConnection } from './use-websocket-connection'

export type WSEvent =
  | { type: 'message.chunk'; sessionId: string; chunk: string }
  | { type: 'message.complete'; sessionId: string; message: any }
  | { type: 'typing.start'; sessionId: string; agentName: string }
  | { type: 'typing.stop'; sessionId: string }
  | { type: 'mcp.start'; sessionId: string; tool: string; action: string }
  | { type: 'mcp.complete'; sessionId: string }
  | { type: 'session.status'; sessionId: string; status: string }
  | { type: 'chat'; sessionId?: string; data?: any }
  | { type: 'agent'; sessionId?: string; data?: any }
  | { type: 'connected'; clientId: string; capabilities?: { instanceBridge: boolean } }
  | { type: 'chat.delta'; sessionId: string; runId: string; seq: number; delta: string }
  | { type: 'chat.final'; sessionId: string; runId: string; seq: number; message: any }
  | { type: 'chat.error'; sessionId: string; runId: string; seq: number; error: string }
  | { type: 'agent.typing'; sessionId: string; agentId: string; isTyping: boolean }
  | { type: 'state.changed'; sessionId: string; state: string; error?: string }
  | { type: 'error'; sessionId?: string; error: string }

interface UseChatWebSocketOptions {
  sessionId?: string
  agentId?: string
  onMessage?: (event: WSEvent) => void
  enabled?: boolean
  useInstanceBridge?: boolean
}

export function useChatWebSocket({ sessionId, agentId, onMessage, enabled = true, useInstanceBridge = false }: UseChatWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [instanceState, setInstanceState] = useState<string | null>(null)
  const [currentSeq, setCurrentSeq] = useState(0)
  const wsRef = useRef<WebSocketConnection | null>(null)
  const prevSessionIdRef = useRef<string | undefined>(undefined)

  if (!wsRef.current) { wsRef.current = createWebSocketConnection() }

  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    ws.setSessionInfo(sessionId, agentId, useInstanceBridge)
    ws.setMessageHandler((data) => onMessage?.(data as WSEvent))
    ws.setEnabled(enabled)
  }, [sessionId, agentId, useInstanceBridge, onMessage, enabled])

  useEffect(() => { wsRef.current?.setSavedSeq(currentSeq) }, [currentSeq])

  useEffect(() => {
    if (enabled) {
      wsRef.current?.connect(
        (event) => onMessage?.(event as WSEvent),
        enabled, 5, 2000,
        isConnecting, setIsConnecting, setIsConnected, setInstanceState, setCurrentSeq
      )
    }
    return () => { wsRef.current?.disconnect() }
  }, [enabled])

  useEffect(() => {
    if (!sessionId || !isConnected) return
    if (prevSessionIdRef.current && prevSessionIdRef.current !== sessionId) { wsRef.current?.unsubscribe(prevSessionIdRef.current) }
    wsRef.current?.subscribe(sessionId)
    prevSessionIdRef.current = sessionId
    return () => { if (sessionId && isConnected) wsRef.current?.unsubscribe(sessionId) }
  }, [sessionId, isConnected])

  return {
    isConnected, isConnecting, instanceState, currentSeq,
    subscribe: (s: string) => wsRef.current?.subscribe(s),
    unsubscribe: (s: string) => wsRef.current?.unsubscribe(s),
    sendTyping: (s: string) => wsRef.current?.sendTyping(s),
    reconnect: () => wsRef.current?.connect((event) => onMessage?.(event as WSEvent), enabled, 5, 2000, isConnecting, setIsConnecting, setIsConnected, setInstanceState, setCurrentSeq),
    sendChatMessage: (c: string, o?: Record<string, unknown>) => wsRef.current?.sendChatMessage(c, o) ?? false,
    abortChat: (r: string) => wsRef.current?.abortChat(r),
  }
}