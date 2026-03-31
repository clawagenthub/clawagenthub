export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.info('🚀 ClawAgentHub starting...')
    
    try {
      const { ensureDatabase } = await import('./lib/db/middleware.js')
      const { checkSetupRequired, createSetupToken, displaySetupUrl } = await import('./lib/setup/index.js')
      
      // Ensure database is initialized
      await ensureDatabase()
      
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
}
