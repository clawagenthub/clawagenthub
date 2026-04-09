import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import logger from "@/lib/logger/index.js"


export async function GET(_request: NextRequest) {
  const timestamp = new Date().toISOString()
  logger.debug(`\n👤 [AUTH ME API ${timestamp}] GET /api/auth/me`)
  
  try {
    // Ensure database is initialized
    await ensureDatabase()
    logger.debug('   ✓ Database initialized')

    // Get session token from cookies using next/headers
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value
    logger.debug(`   🍪 Session token present: ${!!sessionToken}`)
    
    if (sessionToken) {
      logger.debug(`   🍪 Token preview: ${sessionToken.substring(0, 10)}...`)
    }

    if (!sessionToken) {
      logger.debug('   ❌ No session token found in cookies')
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    // Get user from session
    logger.debug('   🔍 Looking up user from session...')
    const user = getUserFromSession(sessionToken)

    if (!user) {
      logger.debug('   ❌ No user found for session token (invalid or expired)')
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    logger.debug(`   ✅ User found - ID: ${user.id}`)
    logger.debug(`   ✅ Email: ${user.email}`)
    logger.debug(`   ✅ Is superuser: ${user.is_superuser}`)
    logger.debug(`   ✅ First password changed: ${user.first_password_changed}`)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        is_superuser: user.is_superuser,
        first_password_changed: user.first_password_changed,
      },
    })
  } catch (error) {
    logger.error('   ❌ Auth check error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
