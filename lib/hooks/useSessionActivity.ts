import { useEffect, useRef, useCallback } from 'react'
import logger, { logCategories } from '@/lib/logger/index.js'


interface UseSessionActivityOptions {
  sessionId: string | null
  enabled?: boolean
  heartbeatInterval?: number // milliseconds
}

/**
 * Hook to track user activity and send heartbeat updates to the server
 * This keeps the session marked as 'active' while the user is interacting
 */
export function useSessionActivity({
  sessionId,
  enabled = true,
  heartbeatInterval = 30000, // Default: every 30 seconds
}: UseSessionActivityOptions) {
  const lastHeartbeatRef = useRef<number>(0)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  /**
   * Send heartbeat to server to update session activity
   */
  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !enabled) {
      logger.debug({ category: logCategories.SESSION_HEARTBEAT }, '[useSessionActivity] sendHeartbeat skipped - no sessionId or disabled')
      return
    }

    const now = Date.now()
    // Debounce: don't send more frequently than every 5 seconds
    if (now - lastHeartbeatRef.current < 5000) {
      logger.debug({ category: logCategories.SESSION_HEARTBEAT }, '[useSessionActivity] sendHeartbeat skipped - debounce (5s)')
      return
    }

    logger.debug('[useSessionActivity] Sending heartbeat to server for session:', sessionId)
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/heartbeat`, {
        method: 'POST',
        credentials: 'include',
      })
      logger.debug('[useSessionActivity] Heartbeat response status:', response.status)
      lastHeartbeatRef.current = now
    } catch (error) {
      logger.error('[useSessionActivity] Failed to send heartbeat:', error)
    }
  }, [sessionId, enabled])

  /**
   * Handle user activity events
   */
  const handleActivity = useCallback(() => {
    if (!enabled) return
    
    // Clear any pending heartbeat
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
    }
    
    // Schedule a heartbeat (debounced)
    heartbeatTimeoutRef.current = setTimeout(() => {
      sendHeartbeat()
    }, 1000) // Wait 1 second after last activity before sending
  }, [enabled, sendHeartbeat])

  useEffect(() => {
    if (!enabled || !sessionId) {
      logger.debug({ category: logCategories.SESSION_HEARTBEAT }, '[useSessionActivity] Hook disabled or no sessionId')
      return
    }

    logger.debug('[useSessionActivity] Hook enabled for session:', sessionId)

    // Track user activity events
    const events = [
      'keydown',
      'click',
      'mousedown',
      'touchstart',
      'scroll',
    ]

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Send periodic heartbeat even without user activity
    // This ensures the session stays active if the user is just reading
    const periodicHeartbeat = setInterval(() => {
      logger.debug({ category: logCategories.SESSION_HEARTBEAT }, '[useSessionActivity] Periodic heartbeat triggered')
      sendHeartbeat()
    }, heartbeatInterval)

    // Send initial heartbeat when hook mounts
    logger.debug({ category: logCategories.SESSION_HEARTBEAT }, '[useSessionActivity] Sending initial heartbeat on mount')
    sendHeartbeat()

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      clearInterval(periodicHeartbeat)
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current)
      }
    }
  }, [sessionId, enabled, heartbeatInterval, handleActivity, sendHeartbeat])

  return {
    sendHeartbeat,
  }
}
