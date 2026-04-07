/**
 * Gateway Session State Machine
 * 
 * Manages state transitions and logging for session instances.
 */

import type { InstanceState } from './protocol.js'

export interface StateChangeEvent {
  state: InstanceState
  error?: string
}

/**
 * Manages state transitions for a session instance
 */
export class SessionStateMachine {
  private _state: InstanceState = 'idle'
  private _error?: string
  private readonly sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  /**
   * Get current state
   */
  get state(): InstanceState {
    return this._state
  }

  /**
   * Get current error
   */
  get error(): string | undefined {
    return this._error
  }

  /**
   * Check if instance is active (connected or connecting)
   */
  isActive(): boolean {
    return this._state === 'connected' || this._state === 'connecting'
  }

  /**
   * Transition to new state
   */
  transition(newState: InstanceState, error?: string): StateChangeEvent {
    const oldState = this._state
    this._state = newState
    this._error = error

    console.log('[SessionInstance] State changed', {
      sessionId: this.sessionId,
      oldState,
      newState,
      error
    })

    return { state: newState, error }
  }

  /**
   * Check if state is 'stopped'
   */
  isStopped(): boolean {
    return this._state === 'stopped'
  }
}
