/**
 * @deprecated This endpoint is deprecated as of 2026-03-08
 * 
 * Reason: Replaced by token-based authentication
 * Use instead: POST /api/gateways/[id]/connect
 * 
 * This endpoint references the removed 'pairing_status' column
 * and is no longer functional.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Use POST /api/gateways/[id]/connect instead.',
      deprecated: true,
      replacementEndpoint: '/api/gateways/[id]/connect',
      reason: 'Device pairing system removed in favor of direct token-based authentication'
    },
    { status: 404 }
  )
}
