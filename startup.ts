import { initializeDatabase } from './lib/db/index.js'
import { checkSetupRequired, createSetupToken, displaySetupUrl } from './lib/setup/index.js'
import '@/lib/services/waiting-to-flow-service.js'
import logger, { logCategories } from '@/lib/logger/index.js'

// Initialize database and check for setup
async function startup() {
  logger.info({ category: logCategories.INITIALIZATION }, '🚀 ClawAgentHub starting...')

  initializeDatabase()

  const setupRequired = checkSetupRequired()

  if (setupRequired) {
    const token = createSetupToken()
    displaySetupUrl(token)
  } else {
    logger.info({ category: logCategories.INITIALIZATION }, '✓ Superuser exists, ready to go!')
  }
}

startup().catch((error) => logger.error({ category: logCategories.INITIALIZATION }, 'Startup failed', { error }))
