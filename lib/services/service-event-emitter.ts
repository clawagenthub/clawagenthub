import logger, { logCategories } from '@/lib/logger/index.js'

/**
 * ServiceEventEmitter - A lightweight event emitter for reactive state updates
 * 
 * Provides a subscribe/notify pattern for managing service state with
 * immutable updates and automatic cleanup.
 */

export interface ServiceEventEmitter<T> {
  /**
   * Subscribe to state changes
   * @param listener - Callback function called when state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: (state: T) => void): () => void
  
  /**
   * Get current state
   */
  get(): T
  
  /**
   * Update state
   * @param newState - New state object or updater function
   */
  set(newState: T | ((prev: T) => T)): void
  
  /**
   * Emit state change to all subscribers
   * @param state - State to emit
   */
  emit(state: T): void
  
  /**
   * Get the number of active subscribers
   */
  getSubscriberCount(): number
}

export interface ServiceEventEmitterOptions {
  /**
   * Enable debug logging
   */
  debug?: boolean
  
  /**
   * Name for debugging purposes
   */
  name?: string
}

/**
 * Create a new ServiceEventEmitter instance
 */
export function createServiceEventEmitter<T>(
  initialState: T,
  options: ServiceEventEmitterOptions = {}
): ServiceEventEmitter<T> {
  const { debug = false, name = 'ServiceEventEmitter' } = options
  
  let state: T = initialState
  const listeners = new Set<(state: T) => void>()
  
  const log = (...args: unknown[]) => {
    if (debug) {
      logger.debug(`[${name}]`, ...args)
    }
  }
  
  return {
    subscribe(listener: (state: T) => void): () => void {
      listeners.add(listener)
      log('Subscriber added. Total:', listeners.size)
      
      // Immediately call listener with current state
      try {
        listener(state)
      } catch (error) {
        logger.error(`[${name}] Error in subscriber:`, error)
      }
      
      // Return unsubscribe function
      return () => {
        listeners.delete(listener)
        log('Subscriber removed. Total:', listeners.size)
      }
    },
    
    get(): T {
      return state
    },
    
    set(newState: T | ((prev: T) => T)): void {
      const previousState = state
      
      if (typeof newState === 'function') {
        state = (newState as (prev: T) => T)(state)
      } else {
        state = newState
      }
      
      log('State updated:', { previousState, newState: state })
      this.emit(state)
    },
    
    emit(newState: T): void {
      state = newState
      log('Emitting to', listeners.size, 'subscribers')
      
      for (const listener of listeners) {
        try {
          listener(newState)
        } catch (error) {
          logger.error(`[${name}] Error in listener:`, error)
        }
      }
    },
    
    getSubscriberCount(): number {
      return listeners.size
    }
  }
}

/**
 * Create a selector hook for a specific slice of state
 * This is useful for optimizing React components to only re-render
 * when the selected value changes
 */
export function createSelector<T, R>(
  emitter: ServiceEventEmitter<T>,
  selector: (state: T) => R
): {
  getValue(): R
  subscribe(listener: (value: R) => void): () => void
} {
  let currentValue = selector(emitter.get())
  let previousValue = currentValue
  
  return {
    getValue(): R {
      return currentValue
    },
    
    subscribe(listener: (value: R) => void): () => void {
      return emitter.subscribe((state) => {
        const newValue = selector(state)
        
        // Only call listener if selected value changed
        if (newValue !== previousValue) {
          previousValue = newValue
          currentValue = newValue
          listener(newValue)
        }
      })
    }
  }
}
