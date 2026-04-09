import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import logger, { logCategories } from '@/lib/logger/index.js'


export type StoredAttachmentKind = 'image' | 'pdf' | 'file'

export interface StoredAttachmentInput {
  name: string
  mimeType: string
  size: number
  kind: StoredAttachmentKind
  dataBase64: string
}

export interface StoredAttachmentRecord {
  id: string
  kind: StoredAttachmentKind
  name: string
  mimeType: string
  size: number
  relativePath: string
  absolutePath: string
  url: string
  createdAt: string
}

// Use /tmp/photos to match OpenClaw's $tempPath variable used in flow templates
// This ensures images are accessible by the agent at /tmp/photos/...
const ATTACHMENTS_ROOT = path.join(process.cwd(), 'temp', 'photos')

// Get base URL for constructing absolute URLs for agent access
function getBaseUrl(): string {
  return process.env.BASE_URL || 'http://localhost:7777'
}

function sanitizeFileName(name: string) {
  const trimmed = name.trim() || 'attachment'
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function storeAttachments(
  inputs: StoredAttachmentInput[]
): Promise<StoredAttachmentRecord[]> {
  if (!inputs.length) return []

  await fs.mkdir(ATTACHMENTS_ROOT, { recursive: true })

  const createdAt = new Date().toISOString()
  const dateFolder = createdAt.slice(0, 10)
  const targetDir = path.join(ATTACHMENTS_ROOT, dateFolder)
  await fs.mkdir(targetDir, { recursive: true })

  const baseUrl = getBaseUrl()
  const records: StoredAttachmentRecord[] = []

  for (const input of inputs) {
    const id = randomUUID()
    const safeName = sanitizeFileName(input.name)
    const fileName = `${id}-${safeName}`
    const absolutePath = path.join(targetDir, fileName)
    // Attachment storage is server-only; use console until logger is available in this module
    logger.debug('Storing attachment:', absolutePath)
    const buffer = Buffer.from(input.dataBase64, 'base64')

    await fs.writeFile(absolutePath, buffer)

    const relativePath = path
      .join('temp', 'photos', dateFolder, fileName)
      .replace(/\\/g, '/')
    records.push({
      id,
      kind: input.kind,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      relativePath,
      absolutePath,
      // Use absolute URL with BASE_URL so agent can access via web_fetch
      // Format: http://localhost:7777/api/attachments/temp/photos/...
      url: `${baseUrl}/api/attachments/${relativePath}`,
      createdAt,
    })
  }

  return records
}
