import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '@/lib/db/index.js'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifyPassword, hashPassword, validatePassword } from '@/lib/auth/password.js'
import { getUserFromSession, deleteUserSessions, createSession } from '@/lib/auth/session.js'
import logger from "@/lib/logger/index.js"


export async function POST(request: NextRequest) {
  try {
    // Ensure database is initialized
    await ensureDatabase()

    // Get session token from cookies using next/headers
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    // Get user from session
    const user = getUserFromSession(sessionToken)

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    logger.debug('🔐 Password change attempt for user:', user.email)

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    // Verify current password
    const validCurrentPassword = await verifyPassword(
      currentPassword,
      user.password_hash
    )

    if (!validCurrentPassword) {
      logger.debug('❌ Invalid current password for:', user.email)
      return NextResponse.json(
        { message: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Validate new password
    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      logger.debug('❌ New password validation failed:', validation.errors)
      return NextResponse.json(
        { message: 'Password does not meet requirements', errors: validation.errors },
        { status: 400 }
      )
    }

    // Check if new password is different from current
    const samePassword = await verifyPassword(newPassword, user.password_hash)
    if (samePassword) {
      return NextResponse.json(
        { message: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password in database and mark first password as changed
    const db = getDatabase()
    const existingSession = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as
      | { current_workspace_id: string | null }
      | undefined

    db.prepare(
      "UPDATE users SET password_hash = ?, first_password_changed = 1, updated_at = datetime('now') WHERE id = ?"
    ).run(newPasswordHash, user.id)

    logger.debug('✅ Password updated for:', user.email)

    // Security: Invalidate all existing sessions
    deleteUserSessions(user.id)
    logger.debug('🔒 All sessions invalidated for security')

    // Create new session, preserving current workspace/identity context when possible
    const newSession = createSession(user.id, undefined, {
      workspaceId: existingSession?.current_workspace_id ?? null,
    })

    const response = NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    })

    // Set new session cookie
    response.cookies.set('session_token', newSession.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    return response
  } catch (error) {
    logger.error('Password change error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
