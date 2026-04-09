import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/index.js'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { verifyPassword } from '@/lib/auth/password.js'
import { createSession } from '@/lib/auth/session.js'
import { generateUserId } from '@/lib/auth/token.js'
import { seedDefaultStatuses } from '@/lib/db/seeder.js'
import type { User } from '@/lib/db/schema.js'
import logger, { logCategories } from '@/lib/logger/index.js'


export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  logger.debug(`\n🔐 [LOGIN API ${timestamp}] POST /api/auth/login`)

  try {
    // Ensure database is initialized
    await ensureDatabase()
    logger.debug('   ✓ Database initialized')

    const { email, password, origin } = await request.json()

    logger.debug(`   📧 Login attempt for: ${email}`)
    logger.debug(`   🔑 Password length: ${password?.length}`)
    logger.debug(`   🌐 Origin: ${origin || 'not provided'}`)

    if (!email || !password) {
      logger.debug('   ❌ Missing credentials')
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
      logger.debug(`   ❌ User not found: ${email}`)
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    logger.debug(`   ✓ User found - ID: ${user.id}`)
    logger.debug(`   ✓ Email: ${user.email}`)
    logger.debug(`   ✓ Is superuser: ${user.is_superuser}`)
    logger.debug(`   🔍 Verifying password...`)

    const validPassword = await verifyPassword(password, user.password_hash)

    logger.debug(
      `   ${validPassword ? '✅' : '❌'} Password verification: ${validPassword}`
    )

    if (!validPassword) {
      logger.debug(`   ❌ Invalid password for: ${email}`)
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    logger.debug(`   ✅ Creating session for user: ${user.id}`)
    const session = createSession(user.id, origin)
    logger.debug(
      `   ✅ Session created - Token: ${session.token.substring(0, 10)}...`
    )
    logger.debug(`   ✅ Session expires: ${session.expires_at}`)
    logger.debug(`   ✅ Session origin stored: ${origin || 'none'}`)

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        is_superuser: user.is_superuser,
        first_password_changed: user.first_password_changed,
      },
    })

    logger.debug(`   🍪 Setting session cookie...`)
    response.cookies.set('session_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })
    logger.debug(`   🍪 Cookie settings:`)
    logger.debug(`      - httpOnly: true`)
    logger.debug(`      - secure: ${process.env.NODE_ENV === 'production'}`)
    logger.debug(`      - sameSite: lax`)
    logger.debug(`      - maxAge: 86400 (24 hours)`)
    logger.debug(`      - path: /`)

    logger.debug(`   ✅ Login successful for: ${email}`)

    // Auto-create workspace for new users if they don't have one
    const workspaces = db
      .prepare(
        `SELECT w.id FROM workspaces w
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = ?`
      )
      .all(user.id) as { id: string }[]

    if (workspaces.length === 0) {
      logger.debug(`   🌐 No workspace found, creating default workspace...`)
      const workspaceId = generateUserId()
      const memberId = generateUserId()
      const now = new Date().toISOString()

      // Create default workspace
      db.prepare(
        `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(workspaceId, 'Default Workspace', user.id, now, now)

      // Add user as owner
      db.prepare(
        `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
         VALUES (?, ?, ?, 'owner', ?)`
      ).run(memberId, workspaceId, user.id, now)

      // Seed default statuses
      seedDefaultStatuses(workspaceId)

      // Set as current workspace
      db.prepare(
        `UPDATE sessions SET current_workspace_id = ? WHERE token = ?`
      ).run(workspaceId, session.token)

      logger.debug(`   ✅ Default workspace created: ${workspaceId}`)
    }

    return response
  } catch (error) {
    logger.error(`   ❌ Login error:`, error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
