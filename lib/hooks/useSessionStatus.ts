/**
 * useSessionStatus Hook
 * 
 * React hook for subscribing to real-time session status updates.
 * Connects to the WebSocket 'sessions' channel to receive status updates.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SessionStatus, SessionStatusType } from '@/lib/session/status-tracker'

interface UseSessionStatusOptions {
  enabled?: boolean
}

interface UseSessionStatusResult {
  statuses: Map<string, SessionStatus>
  getStatus: (sessionId: string) => SessionStatus | undefined
  getStatusesByType: (statusType: SessionStatusType) => SessionStatus[]
  getActiveCount: () => number
  getLiveCount: () => number
  isConnected: boolean
}

/**
 * Hook for real-time session status tracking
 * 
 * @example
 * ```tsx
 * const { getStatus, statuses } = useSessionStatus()
 * const status = getStatus(sessionId)
 * ```
 */
export function useSessionStatus(options: UseSessionStatusOptions = {}): UseSessionStatusResult {
  const { enabled = true } = options
  
  const [statuses, setStatuses] = useState<Map<string, SessionStatus>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Connect to WebSocket for session status updates
  useEffect(() => {
    if (!enabled) {
      return
    }

    const connect = () => {
      // WS auth is cookie-based (httpOnly session cookie validated server-side)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host
      const wsUrl = `${protocol}//${host}/api/chat/ws`

      console.log('[useSessionStatus] Connecting to WebSocket:', wsUrl)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[useSessionStatus] WebSocket connected')
        setIsConnected(true)

        // Subscribe to sessions channel
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'sessions'
        }))

        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          if (message.type === 'session.status') {
            const status: SessionStatus = message.data
            console.log('[useSessionStatus] Status update received:', status)
            
            setStatuses(prev => {
              const next = new Map(prev)
              next.set(status.sessionId, status)
              return next
            })
          }
          else if (message.type === 'session.statuses') {
            // Initial batch of statuses
            const allStatuses: SessionStatus[] = message.data || []
            console.log('[useSessionStatus] Initial statuses received:', allStatuses.length)
            
            setStatuses(new Map(allStatuses.map(s => [s.sessionId, s])))
          }
        } catch (error) {
          console.error('[useSessionStatus] Failed to parse message:', error)
        }
      }

      ws.onclose = () => {
        console.log('[useSessionStatus] WebSocket disconnected')
        setIsConnected(false)
        wsRef.current = null

        // Reconnect after 3 seconds
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[useSessionStatus] Reconnecting...')
            connect()
          }, 3000)
        }
      }

      ws.onerror = (error) => {
        console.error('[useSessionStatus] WebSocket error:', error)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled])

  // Get status for a specific session
  const getStatus = useCallback((sessionId: string): SessionStatus | undefined => {
    return statuses.get(sessionId)
  }, [statuses])

  // Get all sessions with a specific status type
  const getStatusesByType = useCallback((statusType: SessionStatusType): SessionStatus[] => {
    return Array.from(statuses.values()).filter(s => s.status === statusType)
  }, [statuses])

  // Get count of active sessions
  const getActiveCount = useCallback((): number => {
    return Array.from(statuses.values()).filter(s => {
      if (s.status === 'stopped') return false
      if (s.status === 'idle') {
        const oneHourAgo = Date.now() - 3600000
        return s.lastActivity > oneHourAgo
      }
      return true
    }).length
  }, [statuses])

  // "Live" means currently processing (thinking/tool/writing), not heartbeat-active.
  const getLiveCount = useCallback((): number => {
    return Array.from(statuses.values()).filter(s =>
      s.status === 'thinking' || s.status === 'calling_mcp' || s.status === 'writing'
    ).length
  }, [statuses])

  return {
    statuses,
    getStatus,
    getStatusesByType,
    getActiveCount,
    getLiveCount,
    isConnected,
  }
}

/**
 * Hook for a single session's status
 * 
 * @example
 * ```tsx
 * const { status, isThinking, isWriting } = useSingleSessionStatus(sessionId)
 * ```
 */
export function useSingleSessionStatus(sessionId: string | null) {
  const { getStatus } = useSessionStatus()
  const [status, setStatus] = useState<SessionStatus | undefined>(undefined)

  useEffect(() => {
    if (!sessionId) {
      setStatus(undefined)
      return
    }

    setStatus(getStatus(sessionId))
  }, [sessionId, getStatus])

  const isThinking = status?.status === 'thinking'
  const isCallingMcp = status?.status === 'calling_mcp'
  const isWriting = status?.status === 'writing'
  const isIdle = status?.status === 'idle'
  const isStopped = status?.status === 'stopped'
  const isFailed = status?.status === 'failed'

  return {
    status,
    isThinking,
    isCallingMcp,
    isWriting,
    isIdle,
    isStopped,
    isFailed,
    toolName: status?.toolName,
    lastActivity: status?.lastActivity,
  }
}
