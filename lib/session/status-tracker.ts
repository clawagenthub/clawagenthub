/**
 * Session Status Tracker
 *
 * Tracks real-time status of chat sessions based on OpenClaw lifecycle events.
 * Status states: idle, thinking, calling_mcp, writing, stopped, failed
 */

import { getWebSocketManager } from '@/lib/websocket/manager'
import logger, { logCategories } from '@/lib/logger/index.js'

export type SessionStatusType =
  | 'idle'
  | 'thinking'
  | 'calling_mcp'
  | 'writing'
  | 'stopped'
  | 'failed'

export interface SessionStatus {
  sessionId: string
  sessionKey: string
  status: SessionStatusType
  runId?: string
  lastActivity: number
  toolName?: string
}

interface SessionStatusTrackerOptions {
  timeoutMs?: number
  cleanupIntervalMs?: number
}

class SessionStatusTracker {
  private status: Map<string, SessionStatus> = new Map()
  private readonly TIMEOUT_MS: number
  private readonly CLEANUP_INTERVAL_MS: number
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private started = false

  constructor(options: SessionStatusTrackerOptions = {}) {
    this.TIMEOUT_MS = options.timeoutMs ?? 3600000 // 1 hour default
    this.CLEANUP_INTERVAL_MS = options.cleanupIntervalMs ?? 60000 // 1 minute
  }

  /**
   * Start the tracker and begin periodic cleanup
   */
  start() {
    if (this.started) {
      return
    }

    this.started = true
    logger.debug(
      { category: logCategories.SESSION_STATUS },
      '[SessionStatusTracker] Starting session status tracker...'
    )

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions()
    }, this.CLEANUP_INTERVAL_MS)

    logger.debug(
      { category: logCategories.SESSION_STATUS },
      '[SessionStatusTracker] Session status tracker started'
    )
  }

  /**
   * Stop the tracker and cleanup timers
   */
  stop() {
    if (!this.started) {
      return
    }

    this.started = false

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    logger.debug(
      { category: logCategories.SESSION_STATUS },
      '[SessionStatusTracker] Session status tracker stopped'
    )
  }

  /**
   * Update or create a session status
   */
  updateStatus(
    sessionId: string,
    updates: Partial<Omit<SessionStatus, 'sessionId'>>
  ) {
    const existing = this.status.get(sessionId)
    const previousStatus = existing?.status

    const newStatus: SessionStatus = {
      sessionId,
      sessionKey: updates.sessionKey ?? existing?.sessionKey ?? '',
      status: updates.status ?? 'idle',
      runId: updates.runId,
      lastActivity: updates.lastActivity ?? Date.now(),
      toolName: updates.toolName,
    }

    this.status.set(sessionId, newStatus)

    // Log status changes
    if (previousStatus !== newStatus.status) {
      logger.debug(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusTracker] Status updated: sessionId=%s previous=%s current=%s toolName=%s',
        sessionId,
        previousStatus,
        newStatus.status,
        newStatus.toolName
      )
    }

    // Broadcast the update
    this.broadcastStatus(sessionId, newStatus)
  }

  /**
   * Get status for a specific session
   */
  getStatus(sessionId: string): SessionStatus | undefined {
    return this.status.get(sessionId)
  }

  /**
   * Get all tracked statuses
   */
  getAllStatuses(): SessionStatus[] {
    return Array.from(this.status.values())
  }

  /**
   * Get statuses filtered by type
   */
  getStatusesByType(statusType: SessionStatusType): SessionStatus[] {
    return Array.from(this.status.values()).filter(
      (s) => s.status === statusType
    )
  }

  /**
   * Get active sessions (not stopped or idle for too long)
   */
  getActiveSessions(): SessionStatus[] {
    const now = Date.now()
    return Array.from(this.status.values()).filter((s) => {
      if (s.status === 'stopped') return false
      if (s.status === 'idle') {
        // Consider idle sessions as active if they had recent activity
        return now - s.lastActivity < this.TIMEOUT_MS
      }
      return true
    })
  }

  /**
   * Mark a session as stopped
   */
  markSessionStopped(sessionId: string) {
    const existing = this.status.get(sessionId)
    if (existing && existing.status !== 'stopped') {
      this.updateStatus(sessionId, {
        status: 'stopped',
        lastActivity: Date.now(),
      })
    }
  }

  /**
   * Remove a session from tracking
   */
  removeSession(sessionId: string) {
    this.status.delete(sessionId)
    logger.debug(
      { category: logCategories.SESSION_STATUS },
      '[SessionStatusTracker] Session removed from tracking: %s',
      sessionId
    )
  }

  /**
   * Cleanup sessions that have been inactive longer than timeout
   */
  private cleanupExpiredSessions() {
    const now = Date.now()
    let cleaned = 0

    for (const [sessionId, status] of this.status.entries()) {
      // Don't cleanup already stopped sessions
      if (status.status === 'stopped') {
        // Remove stopped sessions after 24 hours
        if (now - status.lastActivity > 86400000) {
          this.removeSession(sessionId)
          cleaned++
        }
        continue
      }

      // Mark inactive sessions as stopped
      if (
        now - status.lastActivity > this.TIMEOUT_MS &&
        status.status === 'idle'
      ) {
        this.markSessionStopped(sessionId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusTracker] Cleaned up: %s expired sessions',
        cleaned
      )
    }
  }

  /**
   * Broadcast status update to all connected WebSocket clients
   */
  private broadcastStatus(sessionId: string, status: SessionStatus) {
    try {
      const wsManager = getWebSocketManager()

      // Broadcast to 'sessions' channel - all clients listening to session updates
      wsManager.broadcast('sessions', {
        type: 'session.status',
        data: status,
      })

      // Also broadcast to the specific session's channel
      wsManager.broadcast(sessionId, {
        type: 'session.status',
        data: status,
      })

      logger.debug(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusTracker] Broadcast status: sessionId=%s status=%s',
        sessionId,
        status.status
      )
    } catch (error) {
      logger.error(
        { category: logCategories.SESSION_STATUS },
        '[SessionStatusTracker] Failed to broadcast status: %s',
        String(error)
      )
    }
  }

  /**
   * Get the count of active sessions
   */
  getActiveCount(): number {
    return this.getActiveSessions().length
  }

  /**
   * Check if the tracker is running
   */
  isRunning(): boolean {
    return this.started
  }
}

// Singleton instance
let trackerInstance: SessionStatusTracker | null = null

export function getSessionStatusTracker(): SessionStatusTracker {
  if (!trackerInstance) {
    trackerInstance = new SessionStatusTracker()
    // Auto-start on first access
    trackerInstance.start()
  }
  return trackerInstance
}

export function resetSessionStatusTrackerForTest() {
  if (trackerInstance) {
    trackerInstance.stop()
    trackerInstance = null
  }
}
