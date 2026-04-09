import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { createSuperuser } from '@/lib/setup/index.js'
import { setupSchema, validateSetupPasswords } from '@/lib/utils/validation.js'
import logger, { logCategories } from '@/lib/logger/index.js'


export async function POST(request: NextRequest) {
  try {
    // Ensure database is initialized
    await ensureDatabase()

    const body = await request.json()

    // Validate input
    const validation = setupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { message: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, password, token } = validation.data

    // Validate passwords match
    const passwordValidation = validateSetupPasswords(validation.data)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { message: passwordValidation.error },
        { status: 400 }
      )
    }

    // Create superuser
    const user = await createSuperuser(email, password, token)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        is_superuser: user.is_superuser,
      },
    })
  } catch (error) {
    logger.error('Setup create error:', error)
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
