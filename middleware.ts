import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/db/index.js'
import type { Session } from '@/lib/db/schema.js'

// Public routes that don't require authentication
const publicRoutes = ['/login', '/setup', '/api/setup/check', '/api/setup/create', '/api/auth/login']

// Static assets and Next.js internals to skip
const skipRoutes = ['/_next', '/favicon.ico', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const timestamp = new Date().toISOString()

  console.log(`\n🔒 [MIDDLEWARE ${timestamp}] Request: ${request.method} ${pathname}`)

  // Skip static assets and Next.js internals
  if (skipRoutes.some(route => pathname.startsWith(route))) {
    console.log(`   ✓ Skipping route (static/internal): ${pathname}`)
    return NextResponse.next()
  }

  // Allow public routes without authentication
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
    console.log(`   ✓ Public route allowed: ${pathname}`)
    return NextResponse.next()
  }

  // Get session token from cookies
  const sessionToken = request.cookies.get('session_token')?.value
  console.log(`   🍪 Session token present: ${!!sessionToken}`)
  if (sessionToken) {
    console.log(`   🍪 Token preview: ${sessionToken.substring(0, 10)}...`)
  }

  // If no session token, redirect to login or return 401 for API routes
  if (!sessionToken) {
    console.log(`   ❌ No session token - redirecting to login`)
    if (pathname.startsWith('/api/')) {
      console.log(`   ❌ API route - returning 401`)
      return NextResponse.json({ message: 'Unauthorized - No session token' }, { status: 401 })
    }
    console.log(`   ↪️  Redirecting to /login`)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Validate session token server-side
  try {
    console.log(`   🔍 Validating session token in database...`)
    const db = getDatabase()
    const session = db
      .prepare(
        `SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`
      )
      .get(sessionToken) as Session | undefined

    // If session is invalid or expired, clear cookie and redirect
    if (!session) {
      console.log(`   ❌ Invalid or expired session token`)
      
      if (pathname.startsWith('/api/')) {
        console.log(`   ❌ API route - returning 401 and clearing cookie`)
        const response = NextResponse.json(
          { message: 'Unauthorized - Invalid or expired session' },
          { status: 401 }
        )
        response.cookies.delete('session_token')
        return response
      }
      
      console.log(`   ↪️  Clearing cookie and redirecting to /login`)
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('session_token')
      return response
    }

    console.log(`   ✅ Valid session found - User ID: ${session.user_id}`)
    console.log(`   ✅ Session expires: ${session.expires_at}`)

    // If user is authenticated and trying to access login page, redirect to dashboard
    if (pathname === '/login') {
      console.log(`   ↪️  User authenticated, redirecting from /login to /dashboard`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Valid session - allow request to proceed
    console.log(`   ✅ Access granted to: ${pathname}`)
    return NextResponse.next()
  } catch (error) {
    console.error(`   ❌ Middleware error:`, error)
    
    // On error, allow request to proceed (fail open for non-critical paths)
    // API routes will still be protected by their own auth checks
    if (pathname.startsWith('/api/')) {
      console.log(`   ❌ API route error - returning 500`)
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      )
    }
    
    console.log(`   ⚠️  Error occurred, allowing request to proceed`)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
