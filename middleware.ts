import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import logger, { logCategories } from '@/lib/logger/index.js'

const publicRoutes = [
  '/login',
  '/setup',
  '/api/setup/check',
  '/api/setup/create',
  '/api/auth/login',
  '/api/cron/stale-check',
]

const skipRoutes = ['/_next', '/favicon.ico', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  logger.info(
    { category: logCategories.MIDDLEWARE },
    'Request: %s %s',
    request.method,
    pathname
  )

  if (skipRoutes.some((route) => pathname.startsWith(route))) {
    logger.info(
      { category: logCategories.MIDDLEWARE },
      'Skipping route (static/internal): %s',
      pathname
    )
    return NextResponse.next()
  }

  if (
    publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(route)
    )
  ) {
    logger.info(
      { category: logCategories.MIDDLEWARE },
      'Public route allowed: %s',
      pathname
    )
    return NextResponse.next()
  }

  // IMPORTANT:
  // Middleware must stay cookie/path-token only.
  // Do NOT add database access here (no getDatabase / session SQL lookup), because
  // middleware runs in constrained runtimes where Node/DB bindings can break loading,
  // which surfaces as generic "middleware export missing" errors.
  // Session validity checks belong in API/page handlers via auth helpers.

  // Extract session token from URL path pattern for session-scoped routes
  // Pattern: /api/{sessionId}/...
  let sessionToken = request.cookies.get('session_token')?.value
  let sessionId: string | undefined

  // Check for session-scoped API routes: /api/{sessionId}/...
  const sessionScopedMatch = pathname.match(/^\/api\/([a-zA-Z0-9_-]+)\//)
  if (sessionScopedMatch) {
    sessionId = sessionScopedMatch[1]
    // For session-scoped routes, the sessionId IS the session token
    sessionToken = sessionId
  }

  // Fallback to compound URL pattern for legacy flow routes
  // Pattern: /api/tickets/{ticketId}_{sessionToken}/action
  if (!sessionToken && pathname.startsWith('/api/tickets/')) {
    const compoundMatch = pathname.match(
      /\/api\/tickets\/[a-zA-Z0-9_-]+_([a-zA-Z0-9_-]+)\//
    )
    if (compoundMatch) {
      sessionToken = compoundMatch[1]
    }
  }

  logger.info(
    { category: logCategories.MIDDLEWARE },
    'Session token present: %s',
    String(!!sessionToken)
  )
  if (sessionToken) {
    logger.debug(
      { category: logCategories.MIDDLEWARE },
      'Token preview: %s...',
      sessionToken.substring(0, 10)
    )
  }

  if (!sessionToken) {
    logger.warn(
      { category: logCategories.MIDDLEWARE },
      'No session token - redirecting to login'
    )
    if (pathname.startsWith('/api/')) {
      logger.warn(
        { category: logCategories.MIDDLEWARE },
        'API route - returning 401'
      )
      return NextResponse.json(
        { message: 'Unauthorized - No session token' },
        { status: 401 }
      )
    }
    logger.info({ category: logCategories.MIDDLEWARE }, 'Redirecting to /login')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  logger.info(
    { category: logCategories.MIDDLEWARE },
    'Token gate passed (cookie/path token present), allowing request'
  )
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
