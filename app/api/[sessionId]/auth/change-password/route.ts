import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifyPassword, hashPassword, validatePassword } from '@/lib/auth/password.js'
import { deleteUserSessions, createSession } from '@/lib/auth/session.js'
import { verifySession } from '@/lib/session/verify'
import logger from "@/lib/logger/index.js"

/**
 * POST /api/{sessionId}/auth/change-password
 * Change user password (session-scoped)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    await ensureDatabase()

    const { sessionId } = await params

    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.debug('🔐 Password change attempt for user:', verification.user.email)

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
      verification.user.password_hash
    )

    if (!validCurrentPassword) {
      logger.debug('❌ Invalid current password for:', verification.user.email)
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
    const samePassword = await verifyPassword(newPassword, verification.user.password_hash)
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
    db.prepare(
      "UPDATE users SET password_hash = ?, first_password_changed = 1, updated_at = datetime('now') WHERE id = ?"
    ).run(newPasswordHash, verification.user.id)

    logger.debug('✅ Password updated for:', verification.user.email)

    // Security: Invalidate all existing sessions
    deleteUserSessions(verification.user.id)
    logger.debug('🔒 All sessions invalidated for security')

    // Create new session, preserving current workspace/identity context
    const newSession = createSession(verification.user.id, undefined, {
      workspaceId: verification.workspaceId ?? null,
      identityId: verification.session.current_identity_id ?? null,
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
