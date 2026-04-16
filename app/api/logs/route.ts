import { NextResponse } from 'next/server'
import { getServerLogger } from '@/lib/logger/server.js'
import { logCategories, type RetentionClass } from '@/lib/logger/shared.js'

type IncomingLogLevel = 'info' | 'error' | 'warn' | 'debug' | 'trace'

interface IncomingLogPayload {
  level: IncomingLogLevel
  category: logCategories
  message: string
  retention?: RetentionClass
  metadata?: Record<string, string | null | undefined>
}

function isValidLevel(value: unknown): value is IncomingLogLevel {
  return (
    value === 'info' ||
    value === 'error' ||
    value === 'warn' ||
    value === 'debug' ||
    value === 'trace'
  )
}

function isValidRetention(value: unknown): value is RetentionClass {
  return value === 'short' || value === 'medium' || value === 'long'
}

function isValidCategory(value: unknown): value is logCategories {
  return (
    typeof value === 'string' &&
    Object.values(logCategories).includes(value as logCategories)
  )
}

function parsePayload(input: unknown): IncomingLogPayload | null {
  if (!input || typeof input !== 'object') return null

  const data = input as Record<string, unknown>
  if (!isValidLevel(data.level)) return null
  if (!isValidCategory(data.category)) return null
  if (
    typeof data.message !== 'string' ||
    data.message.length === 0 ||
    data.message.length > 5000
  )
    return null
  if (data.retention !== undefined && !isValidRetention(data.retention))
    return null

  return {
    level: data.level,
    category: data.category,
    message: data.message,
    retention: data.retention,
    metadata:
      data.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, string | null | undefined>)
        : undefined,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = parsePayload(body)

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid log payload' },
        { status: 400 }
      )
    }

    const logger = getServerLogger()
    const frontendMessage = `[frontend] ${payload.message}`
    const opts = {
      category: payload.category,
      retention: payload.retention,
      metadata: payload.metadata,
    }

    if (payload.level === 'trace') {
      logger.verbose(opts, frontendMessage)
    } else {
      logger[payload.level](opts, frontendMessage)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to process log' },
      { status: 500 }
    )
  }
}
