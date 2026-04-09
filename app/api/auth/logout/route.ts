import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession } from '@/lib/auth/session.js'
import logger, { logCategories } from '@/lib/logger/index.js'


export async function POST(request: NextRequest) {
  try {
    // Get session token from cookies using next/headers
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (sessionToken) {
      deleteSession(sessionToken)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.delete('session_token')

    return response
  } catch (error) {
    logger.error('Logout error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
