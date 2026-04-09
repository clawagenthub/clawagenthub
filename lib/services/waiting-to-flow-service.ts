import { getDatabase } from '@/lib/db'
import { triggerWaitingTickets } from './waiting-to-flow-trigger.js'
import logger, { logCategories } from '@/lib/logger/index.js'

const CHECK_INTERVAL_MS = 10 * 1000

class WaitingToFlowService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  start() {
    if (this.isRunning) {
      logger.info({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Already running')
      return
    }

    logger.info({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Starting waiting-to-flow cron service')
    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.checkWaitingToFlow().catch(error => {
        logger.error({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Error checking waiting tickets: %s', String(error))
      })
    }, CHECK_INTERVAL_MS)

    this.checkWaitingToFlow().catch(error => {
      logger.error({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Error in initial check: %s', String(error))
    })
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    logger.info({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Stopped waiting-to-flow cron service')
  }

  private async checkWaitingToFlow() {
    logger.debug({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Running check for waiting tickets...')
    try {
      const db = getDatabase()
      const workspaces = db.prepare('SELECT id FROM workspaces').all() as Array<{ id: string }>

      logger.debug({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Found %s workspaces', String(workspaces.length))

      for (const workspace of workspaces) {
        try {
          await triggerWaitingTickets(workspace.id)
        } catch (error) {
          logger.error({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Error processing workspace %s: %s', workspace.id, String(error))
        }
      }
    } catch (error) {
      logger.error({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Error fetching workspaces: %s', String(error))
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
  logger.info({ category: logCategories.WAITING_TO_FLOW_SERVICE }, 'Initializing on server start')
  getWaitingToFlowService().start()
}
