import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/index.js'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifyPassword } from '@/lib/auth/password.js'
import { createSession } from '@/lib/auth/session.js'
import type { User } from '@/lib/db/schema.js'

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`\n🔐 [LOGIN API ${timestamp}] POST /api/auth/login`)
  
  try {
    // Ensure database is initialized
    await ensureDatabase()
    console.log('   ✓ Database initialized')

    const { email, password, origin } = await request.json()

    console.log(`   📧 Login attempt for: ${email}`)
    console.log(`   🔑 Password length: ${password?.length}`)
    console.log(`   🌐 Origin: ${origin || 'not provided'}`)

    if (!email || !password) {
      console.log('   ❌ Missing credentials')
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }

    const db = getDatabase()
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as User | undefined

    if (!user) {
      console.log(`   ❌ User not found: ${email}`)
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    console.log(`   ✓ User found - ID: ${user.id}`)
    console.log(`   ✓ Email: ${user.email}`)
    console.log(`   ✓ Is superuser: ${user.is_superuser}`)
    console.log(`   🔍 Verifying password...`)

    const validPassword = await verifyPassword(password, user.password_hash)

    console.log(`   ${validPassword ? '✅' : '❌'} Password verification: ${validPassword}`)

    if (!validPassword) {
      console.log(`   ❌ Invalid password for: ${email}`)
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    console.log(`   ✅ Creating session for user: ${user.id}`)
    const session = createSession(user.id, origin)
    console.log(`   ✅ Session created - Token: ${session.token.substring(0, 10)}...`)
    console.log(`   ✅ Session expires: ${session.expires_at}`)
    console.log(`   ✅ Session origin stored: ${origin || 'none'}`)

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        is_superuser: user.is_superuser,
        first_password_changed: user.first_password_changed,
      },
    })

    console.log(`   🍪 Setting session cookie...`)
    response.cookies.set('session_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })
    console.log(`   🍪 Cookie settings:`)
    console.log(`      - httpOnly: true`)
    console.log(`      - secure: ${process.env.NODE_ENV === 'production'}`)
    console.log(`      - sameSite: lax`)
    console.log(`      - maxAge: 86400 (24 hours)`)
    console.log(`      - path: /`)

    console.log(`   ✅ Login successful for: ${email}`)
    return response
  } catch (error) {
    console.error(`   ❌ Login error:`, error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
