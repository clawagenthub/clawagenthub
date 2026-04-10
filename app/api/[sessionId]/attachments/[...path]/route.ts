import { NextResponse, type NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { verifySession } from '@/lib/session/verify'
import logger from "@/lib/logger/index.js"

/**
 * GET /api/{sessionId}/attachments/{...path}
 * Serve files from temp/photos directory (session-scoped)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; path: string[] }> }
) {
  try {
    const { sessionId, path: pathParts } = await params

    // Verify session
    const verification = verifySession({
      sessionToken: sessionId,
    })

    if (!verification.valid) {
      return NextResponse.json(
        { message: verification.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Reconstruct the relative path from the array
    let relativePath = pathParts.join('/')

    // Security: prevent directory traversal
    if (relativePath.includes('..') || relativePath.includes('//')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // photosDir is already temp/photos, but relativePath includes temp/photos/
    // So we need to strip the leading 'temp/photos/' if present to avoid doubling
    const leadingPrefix = 'temp/photos/'
    if (relativePath.startsWith(leadingPrefix)) {
      relativePath = relativePath.slice(leadingPrefix.length)
    }

    // Construct the absolute path to the file
    const photosDir = path.join(process.cwd(), 'temp', 'photos')
    const absolutePath = path.join(photosDir, relativePath)

    // Ensure the resolved path is within the photos directory
    const resolvedPath = path.resolve(absolutePath)
    const resolvedPhotosDir = path.resolve(photosDir)
    if (!resolvedPath.startsWith(resolvedPhotosDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath)
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get file stats for content-length
    const stats = await fs.stat(resolvedPath)

    // Determine content type based on file extension
    const ext = path.extname(resolvedPath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    // Read and serve the file
    const buffer = await fs.readFile(resolvedPath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stats.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    logger.error('[Attachments API] Error serving file (session-scoped):', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
