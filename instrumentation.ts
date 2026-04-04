export async function register() {
  console.info('🚀 ClawAgentHub starting...')
  
  try {
    const { ensureDatabase } = await import('./lib/db/middleware.js')
    const { checkSetupRequired, createSetupToken, displaySetupUrl } = await import('./lib/setup/index.js')
    
    // Ensure database is initialized
    await ensureDatabase()
    
    // Start the WaitingToFlow cron service
    console.info('[Instrumentation] Loading WaitingToFlowService...')
    const waitingToFlowModule = await import('./lib/services/waiting-to-flow-service.js')
    console.info('[Instrumentation] WaitingToFlowService loaded, instance:', waitingToFlowModule.getWaitingToFlowService ? 'available' : 'NOT AVAILABLE')
    
    // Check if setup is required
    const setupRequired = checkSetupRequired()
    
    if (setupRequired) {
      const token = createSetupToken()
      displaySetupUrl(token)
    } else {
      console.info('✓ Superuser exists, ready to go!')
    }
  } catch (error) {
    console.error('❌ Initialization error:', error)
    console.error('💡 Try running: npm run db:init')
  }
}
