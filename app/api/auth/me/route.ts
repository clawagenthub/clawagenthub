import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`\n👤 [AUTH ME API ${timestamp}] GET /api/auth/me`)
  
  try {
    // Ensure database is initialized
    await ensureDatabase()
    console.log('   ✓ Database initialized')

    // Get session token from cookies using next/headers
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value
    console.log(`   🍪 Session token present: ${!!sessionToken}`)
    
    if (sessionToken) {
      console.log(`   🍪 Token preview: ${sessionToken.substring(0, 10)}...`)
    }

    if (!sessionToken) {
      console.log('   ❌ No session token found in cookies')
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    // Get user from session
    console.log('   🔍 Looking up user from session...')
    const user = getUserFromSession(sessionToken)

    if (!user) {
      console.log('   ❌ No user found for session token (invalid or expired)')
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    console.log(`   ✅ User found - ID: ${user.id}`)
    console.log(`   ✅ Email: ${user.email}`)
    console.log(`   ✅ Is superuser: ${user.is_superuser}`)
    console.log(`   ✅ First password changed: ${user.first_password_changed}`)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        is_superuser: user.is_superuser,
        first_password_changed: user.first_password_changed,
      },
    })
  } catch (error) {
    console.error('   ❌ Auth check error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
