import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/db/index.js'
import type { Session } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'

const publicRoutes = ['/login', '/setup', '/api/setup/check', '/api/setup/create', '/api/auth/login']

const skipRoutes = ['/_next', '/favicon.ico', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  logger.info({ category: logCategories.MIDDLEWARE }, 'Request: %s %s', request.method, pathname)

  if (skipRoutes.some(route => pathname.startsWith(route))) {
    logger.info({ category: logCategories.MIDDLEWARE }, 'Skipping route (static/internal): %s', pathname)
    return NextResponse.next()
  }

  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
    logger.info({ category: logCategories.MIDDLEWARE }, 'Public route allowed: %s', pathname)
    return NextResponse.next()
  }

  const sessionToken = request.cookies.get('session_token')?.value
  logger.info({ category: logCategories.MIDDLEWARE }, 'Session token present: %s', String(!!sessionToken))
  if (sessionToken) {
    logger.debug({ category: logCategories.MIDDLEWARE }, 'Token preview: %s...', sessionToken.substring(0, 10))
  }

  if (!sessionToken) {
    logger.warn({ category: logCategories.MIDDLEWARE }, 'No session token - redirecting to login')
    if (pathname.startsWith('/api/')) {
      logger.warn({ category: logCategories.MIDDLEWARE }, 'API route - returning 401')
      return NextResponse.json({ message: 'Unauthorized - No session token' }, { status: 401 })
    }
    logger.info({ category: logCategories.MIDDLEWARE }, 'Redirecting to /login')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    logger.debug({ category: logCategories.MIDDLEWARE }, 'Validating session token in database...')
    const db = getDatabase()
    const session = db
      .prepare(
        `SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`
      )
      .get(sessionToken) as Session | undefined

    if (!session) {
      logger.warn({ category: logCategories.MIDDLEWARE }, 'Invalid or expired session token')

      if (pathname.startsWith('/api/')) {
        logger.warn({ category: logCategories.MIDDLEWARE }, 'API route - returning 401 and clearing cookie')
        const response = NextResponse.json(
          { message: 'Unauthorized - Invalid or expired session' },
          { status: 401 }
        )
        response.cookies.delete('session_token')
        return response
      }

      logger.info({ category: logCategories.MIDDLEWARE }, 'Clearing cookie and redirecting to /login')
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('session_token')
      return response
    }

    logger.info({ category: logCategories.MIDDLEWARE }, 'Valid session found - User ID: %s', session.user_id)

    if (pathname === '/login') {
      logger.info({ category: logCategories.MIDDLEWARE }, 'User authenticated, redirecting from /login to /dashboard')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    logger.info({ category: logCategories.MIDDLEWARE }, 'Access granted to: %s', pathname)
    return NextResponse.next()
  } catch (error) {
    logger.error({ category: logCategories.MIDDLEWARE }, 'Middleware error: %s', String(error))

    if (pathname.startsWith('/api/')) {
      logger.error({ category: logCategories.MIDDLEWARE }, 'API route error - returning 500')
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      )
    }

    logger.warn({ category: logCategories.MIDDLEWARE }, 'Error occurred, allowing request to proceed')
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
