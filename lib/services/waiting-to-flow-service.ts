import { getDatabase } from '@/lib/db'
import { triggerWaitingTickets } from './waiting-to-flow-trigger.js'

const CHECK_INTERVAL_MS = 10 * 1000

class WaitingToFlowService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  start() {
    if (this.isRunning) {
      console.log('[WaitingToFlowService] Already running')
      return
    }

    console.log('[WaitingToFlowService] Starting waiting-to-flow cron service')
    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.checkWaitingToFlow().catch(error => {
        console.error('[WaitingToFlowService] Error checking waiting tickets:', error)
      })
    }, CHECK_INTERVAL_MS)

    this.checkWaitingToFlow().catch(error => {
      console.error('[WaitingToFlowService] Error in initial check:', error)
    })
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('[WaitingToFlowService] Stopped waiting-to-flow cron service')
  }

  private async checkWaitingToFlow() {
    console.log('[WaitingToFlowService] Running check for waiting tickets...')
    try {
      const db = getDatabase()
      const workspaces = db.prepare('SELECT id FROM workspaces').all() as Array<{ id: string }>

      console.log(`[WaitingToFlowService] Found ${workspaces.length} workspaces`)

      for (const workspace of workspaces) {
        try {
          await triggerWaitingTickets(workspace.id)
        } catch (error) {
          console.error(`[WaitingToFlowService] Error processing workspace ${workspace.id}:`, error)
        }
      }
    } catch (error) {
      console.error('[WaitingToFlowService] Error fetching workspaces:', error)
    }
  }
}

let serviceInstance: WaitingToFlowService | null = null

export function getWaitingToFlowService(): WaitingToFlowService {
  if (!serviceInstance) {
    serviceInstance = new WaitingToFlowService()
  }
  return serviceInstance
}

if (typeof window === 'undefined') {
  console.log('[WaitingToFlowService] Initializing on server start')
  getWaitingToFlowService().start()
}
