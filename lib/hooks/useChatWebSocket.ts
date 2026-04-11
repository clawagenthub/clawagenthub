import { useEffect, useRef, useState } from 'react'
import { createWebSocketConnection, type WebSocketConnection } from './use-websocket-connection'
import logger, { logCategories } from '../logger/index.js'

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
        logger.info({ category: logCategories.WEBSOCKET }, 'Connected')
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
        } catch (error) { logger.error({ category: logCategories.WEBSOCKET }, 'Failed to parse message', error) }
      }

      socket.onerror = (error) => { logger.error({ category: logCategories.WEBSOCKET }, 'Error', error) }

      socket.onclose = () => {
        logger.warn({ category: logCategories.WEBSOCKET }, 'Disconnected')
        setIsConnected(false); setIsConnecting(false); setInstanceState(null); ws = null
        if (enabledRef.current && retries < maxRetries) {
          reconnectTimeout = setTimeout(() => { retries++; connect(onMessageRef.current!, enabledRef.current, maxRetries, retryDelay, false, setIsConnecting, setIsConnected, setInstanceState, setCurrentSeq) }, retryDelay * Math.pow(2, retries))
        }
      }
    } catch (error) { logger.error({ category: logCategories.WEBSOCKET }, 'Connection failed', error); setIsConnecting(false) }
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
