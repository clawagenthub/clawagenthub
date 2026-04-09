import { NextResponse } from 'next/server'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import { GatewayClient } from '@/lib/gateway/client'
import logger, { logCategories } from '@/lib/logger/index.js'


// Common localhost URLs to try (only localhost and 127.0.0.1)
const COMMON_GATEWAY_URLS = [
  'ws://localhost:18789',
  'ws://127.0.0.1:18789',
]

// Don't try common tokens - require user to provide token
// This prevents rate limiting from too many failed attempts
const COMMON_AUTH_TOKENS: string[] = []

interface DiscoveryResult {
  url: string
  reachable: boolean
  requiresAuth: boolean
  authToken?: string
  health?: unknown
  error?: string
}

/**
 * POST /api/gateways/discover - Auto-discover local OpenClaw Gateway
 * 
 * Attempts to connect to common localhost URLs and test authentication.
 * Returns discovered gateways that can be connected to.
 */
export async function POST(request: Request) {
  logger.debug('[POST /api/gateways/discover] Starting request')
  
  try {
    const auth = await getUserWithWorkspace()
    if (!auth) {
      logger.debug('[POST /api/gateways/discover] No valid session or workspace')
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    logger.debug('[POST /api/gateways/discover] Authenticated:', {
      userId: auth.user.id,
      workspaceId: auth.workspaceId
    })

    const body = await request.json()
    const { authToken, customUrl } = body

    logger.debug('[POST /api/gateways/discover] Discovery parameters:', {
      hasAuthToken: !!authToken,
      authTokenLength: authToken?.length,
      customUrl: customUrl || 'none (using defaults)'
    })

    logger.debug('[POST /api/gateways/discover] Starting auto-discovery')

    const origin = request.headers.get('origin') || 'http://localhost:3000'
    logger.debug('[POST /api/gateways/discover] Using origin:', origin)
    
    const results: DiscoveryResult[] = []

    // URLs to try
    const urlsToTry = customUrl ? [customUrl] : COMMON_GATEWAY_URLS
    logger.debug('[POST /api/gateways/discover] URLs to try:', urlsToTry)

    for (const url of urlsToTry) {
      logger.debug(`[POST /api/gateways/discover] === Trying URL: ${url} ===`)

      // If user provided auth token, only try that
      const tokensToTry = authToken ? [authToken] : COMMON_AUTH_TOKENS
      logger.debug(`[POST /api/gateways/discover] Will try ${tokensToTry.length} auth token(s)`)

      for (const token of tokensToTry) {
        const tokenDisplay = token ? `${token.substring(0, 4)}****` : '(no auth)'
        logger.debug(`[POST /api/gateways/discover] Attempting connection with token: ${tokenDisplay}`)
        
        try {
          const client = new GatewayClient(url, { authToken: token, origin })

          // Try to connect with timeout
          logger.debug(`[POST /api/gateways/discover] Creating connection promise...`)
          const connectPromise = client.connect()
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 3000)
          )

          logger.debug(`[POST /api/gateways/discover] Racing connection vs timeout...`)
          await Promise.race([connectPromise, timeoutPromise])

          logger.debug(`[POST /api/gateways/discover] ✓ Connected to ${url}`)

          // Get health info
          let health
          try {
            logger.debug(`[POST /api/gateways/discover] Calling health() RPC...`)
            health = await client.health()
            logger.debug(`[POST /api/gateways/discover] Health response:`, health)
          } catch (err) {
            logger.debug(`[POST /api/gateways/discover] Health check failed:`, {
              error: err,
              message: err instanceof Error ? err.message : String(err)
            })
          }

          await client.disconnect()
          logger.debug(`[POST /api/gateways/discover] Disconnected cleanly`)

          // Success!
          const result = {
            url,
            reachable: true,
            requiresAuth: token !== '',
            authToken: token || undefined,
            health,
          }
          results.push(result)

          logger.debug(`[POST /api/gateways/discover] ✓✓✓ Successfully discovered gateway:`, result)

          // If we found one, we can stop trying other tokens for this URL
          break
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          // Only log if it's not a timeout (expected for non-existent gateways)
          if (!errorMessage.includes('timeout') && !errorMessage.includes('ECONNREFUSED')) {
            logger.debug(
              `[POST /api/gateways/discover] ✗ Failed to connect to ${url} with token ${tokenDisplay}:`,
              {
                error,
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
              }
            )
          } else {
            logger.debug(`[POST /api/gateways/discover] ✗ ${errorMessage} for ${url}`)
          }

          // If this is the last token to try, record the failure
          if (token === tokensToTry[tokensToTry.length - 1]) {
            results.push({
              url,
              reachable: false,
              requiresAuth: false,
              error: errorMessage,
            })
            logger.debug(`[POST /api/gateways/discover] Recorded failure for ${url}`)
          }
        }
      }
    }

    // Filter to only successful discoveries
    const discovered = results.filter((r) => r.reachable)

    logger.debug(`[POST /api/gateways/discover] === Discovery complete ===`)
    logger.debug(`[POST /api/gateways/discover] Total attempts: ${results.length}`)
    logger.debug(`[POST /api/gateways/discover] Successful: ${discovered.length}`)
    logger.debug(`[POST /api/gateways/discover] Failed: ${results.length - discovered.length}`)
    logger.debug(`[POST /api/gateways/discover] Discovered gateways:`, discovered)

    return NextResponse.json({
      discovered,
      allResults: results,
    })
  } catch (error) {
    logger.error('[POST /api/gateways/discover] Fatal error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Discovery failed' },
      { status: 500 }
    )
  }
}
