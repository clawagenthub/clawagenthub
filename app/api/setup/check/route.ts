import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { checkSetupRequired, validateSetupToken } from '@/lib/setup/index.js'

export async function GET(request: NextRequest) {
  try {
    // Ensure database is initialized
    await ensureDatabase()

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    const setupRequired = checkSetupRequired()

    if (!setupRequired) {
      return NextResponse.json({
        setupRequired: false,
        valid: false,
        message: 'Setup already completed',
      })
    }

    if (!token) {
      return NextResponse.json({
        setupRequired: true,
        valid: false,
        message: 'Token required',
      })
    }

    const valid = validateSetupToken(token)

    return NextResponse.json({
      setupRequired: true,
      valid,
      message: valid ? 'Token is valid' : 'Invalid or expired token',
    })
  } catch (error) {
    console.error('Setup check error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
