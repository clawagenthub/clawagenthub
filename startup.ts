import { initializeDatabase } from './lib/db/index.js'
import { checkSetupRequired, createSetupToken, displaySetupUrl } from './lib/setup/index.js'

// Initialize database and check for setup
async function startup() {
  console.info('🚀 ClawAgentHub starting...')
  
  initializeDatabase()
  
  const setupRequired = checkSetupRequired()
  
  if (setupRequired) {
    const token = createSetupToken()
    displaySetupUrl(token)
  } else {
    console.info('✓ Superuser exists, ready to go!')
  }
}

startup().catch(console.error)
