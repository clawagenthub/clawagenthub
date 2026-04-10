import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session/verify'
import { GatewayClient } from '@/lib/gateway/client'
import logger from "@/lib/logger/index.js"

// Common localhost URLs to try (only localhost and 127.0.0.1)
const COMMON_GATEWAY_URLS = [
  'ws://localhost:18789',
  'ws://127.0.0.1:18789',
]

// Don't try common tokens - require user to provide token
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
 * POST /api/{sessionId}/gateways/discover
 * Auto-discover local OpenClaw Gateway (session-scoped)
 * 
 * Attempts to connect to common localhost URLs and test authentication.
 * Returns discovered gateways that can be connected to.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  logger.debug('[POST /api/{sessionId}/gateways/discover] Starting request')
  
  try {
    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid) {
      logger.debug('[POST /api/{sessionId}/gateways/discover] No valid session')
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.debug('[POST /api/{sessionId}/gateways/discover] Authenticated:', {
      userId: verification.userId,
      workspaceId: verification.workspaceId
    })

    const body = await request.json()
    const { authToken, customUrl } = body

    logger.debug('[POST /api/{sessionId}/gateways/discover] Discovery parameters:', {
      hasAuthToken: !!authToken,
      authTokenLength: authToken?.length,
      customUrl: customUrl || 'none (using defaults)'
    })

    logger.debug('[POST /api/{sessionId}/gateways/discover] Starting auto-discovery')

    const origin = request.headers.get('origin') || 'http://localhost:3000'
    logger.debug('[POST /api/{sessionId}/gateways/discover] Using origin:', origin)
    
    const results: DiscoveryResult[] = []

    // URLs to try
    const urlsToTry = customUrl ? [customUrl] : COMMON_GATEWAY_URLS
    logger.debug('[POST /api/{sessionId}/gateways/discover] URLs to try:', urlsToTry)

    for (const url of urlsToTry) {
      logger.debug(`[POST /api/{sessionId}/gateways/discover] === Trying URL: ${url} ===`)

      // If user provided auth token, only try that
      const tokensToTry = authToken ? [authToken] : COMMON_AUTH_TOKENS
      logger.debug(`[POST /api/{sessionId}/gateways/discover] Will try ${tokensToTry.length} auth token(s)`)

      for (const token of tokensToTry) {
        const tokenDisplay = token ? `${token.substring(0, 4)}****` : '(no auth)'
        logger.debug(`[POST /api/{sessionId}/gateways/discover] Attempting connection with token: ${tokenDisplay}`)
        
        try {
          const client = new GatewayClient(url, { authToken: token, origin })

          // Try to connect with timeout
          logger.debug(`[POST /api/{sessionId}/gateways/discover] Creating connection promise...`)
          const connectPromise = client.connect()
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 3000)
          )

          logger.debug(`[POST /api/{sessionId}/gateways/discover] Racing connection vs timeout...`)
          await Promise.race([connectPromise, timeoutPromise])

          logger.debug(`[POST /api/{sessionId}/gateways/discover] ✓ Connected to ${url}`)

          // Get health info
          let health
          try {
            logger.debug(`[POST /api/{sessionId}/gateways/discover] Calling health() RPC...`)
            health = await client.health()
            logger.debug(`[POST /api/{sessionId}/gateways/discover] Health response:`, health)
          } catch (err) {
            logger.debug(`[POST /api/{sessionId}/gateways/discover] Health check failed:`, {
              error: err,
              message: err instanceof Error ? err.message : String(err)
            })
          }

          await client.disconnect()
          logger.debug(`[POST /api/{sessionId}/gateways/discover] Disconnected cleanly`)

          // Success!
          const result = {
            url,
            reachable: true,
            requiresAuth: token !== '',
            authToken: token || undefined,
            health,
          }
          results.push(result)

          logger.debug(`[POST /api/{sessionId}/gateways/discover] ✓✓✓ Successfully discovered gateway:`, result)

          // If we found one, we can stop trying other tokens for this URL
          break
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          // Only log if it's not a timeout (expected for non-existent gateways)
          if (!errorMessage.includes('timeout') && !errorMessage.includes('ECONNREFUSED')) {
            logger.debug(
              `[POST /api/{sessionId}/gateways/discover] ✗ Failed to connect to ${url} with token ${tokenDisplay}:`,
              {
                error,
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
              }
            )
          } else {
            logger.debug(`[POST /api/{sessionId}/gateways/discover] ✗ ${errorMessage} for ${url}`)
          }

          // If this is the last token to try, record the failure
          if (token === tokensToTry[tokensToTry.length - 1]) {
            results.push({
              url,
              reachable: false,
              requiresAuth: false,
              error: errorMessage,
            })
            logger.debug(`[POST /api/{sessionId}/gateways/discover] Recorded failure for ${url}`)
          }
        }
      }
    }

    // Filter to only successful discoveries
    const discovered = results.filter((r) => r.reachable)

    logger.debug(`[POST /api/{sessionId}/gateways/discover] === Discovery complete ===`)
    logger.debug(`[POST /api/{sessionId}/gateways/discover] Total attempts: ${results.length}`)
    logger.debug(`[POST /api/{sessionId}/gateways/discover] Successful: ${discovered.length}`)
    logger.debug(`[POST /api/{sessionId}/gateways/discover] Failed: ${results.length - discovered.length}`)
    logger.debug(`[POST /api/{sessionId}/gateways/discover] Discovered gateways:`, discovered)

    return NextResponse.json({
      discovered,
      allResults: results,
    })
  } catch (error) {
    logger.error('[POST /api/{sessionId}/gateways/discover] Fatal error:', {
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
