/**
 * @deprecated This endpoint is deprecated as of 2026-03-08
 * 
 * Reason: pairing_status column removed from database
 * Use instead: Check gateway status via GET /api/gateways
 * 
 * This endpoint queries the removed 'pairing_status' and 'device_id' columns
 * and is no longer functional.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Check gateway status via GET /api/gateways instead.',
      deprecated: true,
      replacementEndpoint: '/api/gateways',
      reason: 'Device pairing system removed - pairing_status column no longer exists'
    },
    { status: 404 }
  )
}
