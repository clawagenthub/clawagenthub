/**
 * Gateway Session Heartbeat & Idle Management
 * 
 * Handles keepalive timers and idle timeout logic.
 */

export interface IdleTimerConfig {
  idleTimeoutMinutes: number
  onIdle: () => void
}

/**
 * Manages idle timeout for a session instance
 */
export class IdleTimerManager {
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private lastActivityAt: Date = new Date()
  private readonly idleTimeoutMinutes: number
  private readonly onIdle: () => void

  constructor(config: IdleTimerConfig) {
    this.idleTimeoutMinutes = config.idleTimeoutMinutes
    this.onIdle = config.onIdle
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivityAt = new Date()
  }

  /**
   * Schedule idle check after configured timeout
   */
  schedule(): void {
    this.clear()

    this.idleTimer = setTimeout(() => {
      this.check()
    }, this.idleTimeoutMinutes * 60 * 1000)
  }

  /**
   * Clear any pending idle timer
   */
  clear(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  /**
   * Get time since last activity in milliseconds
   */
  getIdleTimeMs(): number {
    return Date.now() - this.lastActivityAt.getTime()
  }

  /**
   * Check if idle timeout has been exceeded
   */
  isIdle(): boolean {
    const idleMinutes = this.getIdleTimeMs() / (60 * 1000)
    return idleMinutes >= this.idleTimeoutMinutes
  }

  /**
   * Perform idle check
   */
  private check(): void {
    const idleMinutes = this.getIdleTimeMs() / (60 * 1000)

    if (idleMinutes >= this.idleTimeoutMinutes) {
      console.log('[SessionInstance] Idle timeout, stopping', {
        idleMinutes: idleMinutes.toFixed(2)
      })
      this.onIdle()
      return
    }

    // Reschedule if not stopping
    this.schedule()
  }

  /**
   * Get current last activity timestamp
   */
  getLastActivityAt(): Date {
    return this.lastActivityAt
  }
}

/**
 * Create a reconnect timer
 */
export function scheduleReconnect(
  getReconnectDelay: () => number,
  connect: () => Promise<void>,
  getState: () => string
): ReturnType<typeof setTimeout> | null {
  const state = getState()
  if (state === 'stopped') return null

  return setTimeout(async () => {
    try {
      await connect()
    } catch {
      // Will retry again via the connection's onClose handler
    }
  }, getReconnectDelay())
}
