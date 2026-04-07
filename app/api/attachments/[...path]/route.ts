import { NextResponse, type NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// Serve files from temp/photos directory
// Path param is the relative path from temp/photos (e.g., "2026-04-07/filename.png")
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Await params in Next.js 15+
    const { path: pathParts } = await params
    // Reconstruct the relative path from the array
    // URL: /api/attachments/temp/photos/2026-04-07/file.png
    // pathParts = ['temp', 'photos', '2026-04-07', 'file.png']
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
    console.error('[Attachments API] Error serving file:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}