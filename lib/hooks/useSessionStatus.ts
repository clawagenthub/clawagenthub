/**
 * useSessionStatus Hook
 *
 * React hook for subscribing to real-time session status updates.
 * Connects to the WebSocket 'sessions' channel to receive status updates.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  SessionStatus,
  SessionStatusType,
} from '@/lib/session/status-tracker'
import logger, { logCategories } from '@/lib/logger/index.js'

interface SessionStatusSnapshot {
  statuses: Map<string, SessionStatus>
  isConnected: boolean
}

type SessionStatusSubscriber = (snapshot: SessionStatusSnapshot) => void

class SessionStatusSocketManager {
  private ws: WebSocket | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private subscribers = new Map<number, SessionStatusSubscriber>()
  private statuses = new Map<string, SessionStatus>()
  private isConnected = false
  private connectAttempts = 0
  private subscriberSeq = 0
  private lastConnectStartedAt = 0
  private lastConnectedAt = 0
  private lastWsUrl = ''

  subscribe(subscriber: SessionStatusSubscriber): () => void {
    const id = ++this.subscriberSeq
    this.subscribers.set(id, subscriber)

    subscriber(this.getSnapshot())
    this.ensureConnected()

    return () => {
      this.subscribers.delete(id)
      if (this.subscribers.size === 0) {
        this.teardown()
      }
    }
  }

  getSnapshot(): SessionStatusSnapshot {
    return {
      statuses: new Map(this.statuses),
      isConnected: this.isConnected,
    }
  }

  private notifySubscribers(): void {
    const snapshot = this.getSnapshot()
    for (const subscriber of this.subscribers.values()) {
      subscriber(snapshot)
    }
  }

  private ensureConnected(): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      logger.debug(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusSocketManager] ensureConnected skipped readyState=%s subscribers=%s',
        String(this.ws?.readyState ?? '(none)'),
        String(this.subscribers.size)
      )
      return
    }

    this.connectAttempts += 1

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host
    const wsUrl = `${protocol}//${host}/api/chat/ws`
    this.lastConnectStartedAt = Date.now()
    this.lastWsUrl = wsUrl

    logger.debug(
      { category: logCategories.SESSION_STATUS },
      '[SessionStatusSocketManager] connect attempt=%s url=%s subscribers=%s page=%s visibility=%s',
      String(this.connectAttempts),
      wsUrl,
      String(this.subscribers.size),
      `${window.location.pathname}${window.location.search}`,
      document.visibilityState
    )

    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.isConnected = true
      this.lastConnectedAt = Date.now()
      this.notifySubscribers()

      logger.debug(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusSocketManager] connected readyState=%s connectMs=%s url=%s',
        String(this.ws?.readyState ?? '(none)'),
        String(Math.max(0, this.lastConnectedAt - this.lastConnectStartedAt)),
        this.lastWsUrl
      )

      this.ws?.send(
        JSON.stringify({
          type: 'subscribe',
          channel: 'sessions',
        })
      )

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
        this.reconnectTimeout = null
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'session.status') {
          const status: SessionStatus = message.data
          this.statuses.set(status.sessionId, status)
          this.notifySubscribers()
        } else if (message.type === 'session.statuses') {
          const allStatuses: SessionStatus[] = message.data || []
          this.statuses = new Map(allStatuses.map((s) => [s.sessionId, s]))
          this.notifySubscribers()
        }
      } catch (error) {
        logger.error(
          { category: logCategories.SESSION_STATUS },
          '[SessionStatusSocketManager] Failed to parse message: %s',
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    this.ws.onclose = (event) => {
      this.ws = null
      this.isConnected = false
      this.notifySubscribers()

      const now = Date.now()
      const connectedForMs =
        this.lastConnectedAt > 0 ? Math.max(0, now - this.lastConnectedAt) : -1

      logger.debug(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusSocketManager] disconnected code=%s reason=%s wasClean=%s connectedForMs=%s subscribers=%s url=%s',
        String(event.code),
        event.reason || '(none)',
        String(event.wasClean),
        String(connectedForMs),
        String(this.subscribers.size),
        this.lastWsUrl
      )

      if (this.subscribers.size > 0) {
        logger.debug(
          { category: logCategories.SESSION_STATUS },
          '[SessionStatusSocketManager] scheduling reconnect in 3000ms (code=%s)',
          String(event.code)
        )
        this.reconnectTimeout = setTimeout(() => this.ensureConnected(), 3000)
      }
    }

    this.ws.onerror = (event) => {
      logger.error(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusSocketManager] WebSocket error event=%s readyState=%s bufferedAmount=%s url=%s',
        String(event),
        String(this.ws?.readyState ?? '(none)'),
        String(this.ws?.bufferedAmount ?? 0),
        this.lastWsUrl
      )
    }
  }

  private teardown(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      logger.debug(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusSocketManager] closing socket during teardown readyState=%s url=%s',
        String(this.ws.readyState),
        this.lastWsUrl
      )
      this.ws.close()
      this.ws = null
    }

    this.isConnected = false
    logger.debug(
      { category: logCategories.SESSION_STATUS },
      '[SessionStatusSocketManager] teardown (no subscribers)'
    )
  }
}

let sessionStatusManager: SessionStatusSocketManager | null = null

function getSessionStatusManager(): SessionStatusSocketManager {
  if (!sessionStatusManager) {
    sessionStatusManager = new SessionStatusSocketManager()
  }
  return sessionStatusManager
}

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
export function useSessionStatus(
  options: UseSessionStatusOptions = {}
): UseSessionStatusResult {
  const { enabled = true } = options
  const managerRef = useRef<SessionStatusSocketManager | null>(null)

  if (!managerRef.current) {
    managerRef.current = getSessionStatusManager()
  }

  const initialSnapshot = managerRef.current.getSnapshot()
  const [statuses, setStatuses] = useState<Map<string, SessionStatus>>(
    initialSnapshot.statuses
  )
  const [isConnected, setIsConnected] = useState(initialSnapshot.isConnected)

  useEffect(() => {
    if (!enabled || !managerRef.current) {
      setIsConnected(false)
      return
    }

    return managerRef.current.subscribe((snapshot) => {
      setStatuses(snapshot.statuses)
      setIsConnected(snapshot.isConnected)
    })
  }, [enabled])

  // Get status for a specific session
  const getStatus = useCallback(
    (sessionId: string): SessionStatus | undefined => {
      return statuses.get(sessionId)
    },
    [statuses]
  )

  // Get all sessions with a specific status type
  const getStatusesByType = useCallback(
    (statusType: SessionStatusType): SessionStatus[] => {
      return Array.from(statuses.values()).filter(
        (s) => s.status === statusType
      )
    },
    [statuses]
  )

  // Get count of active sessions
  const getActiveCount = useCallback((): number => {
    return Array.from(statuses.values()).filter((s) => {
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
    return Array.from(statuses.values()).filter(
      (s) =>
        s.status === 'thinking' ||
        s.status === 'calling_mcp' ||
        s.status === 'writing'
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
