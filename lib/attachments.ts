import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

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

const ATTACHMENTS_ROOT = path.join(process.cwd(), 'temp', 'photos')

function sanitizeFileName(name: string) {
  const trimmed = name.trim() || 'attachment'
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function storeAttachments(inputs: StoredAttachmentInput[]): Promise<StoredAttachmentRecord[]> {
  if (!inputs.length) return []

  await fs.mkdir(ATTACHMENTS_ROOT, { recursive: true })

  const createdAt = new Date().toISOString()
  const dateFolder = createdAt.slice(0, 10)
  const targetDir = path.join(ATTACHMENTS_ROOT, dateFolder)
  await fs.mkdir(targetDir, { recursive: true })

  const records: StoredAttachmentRecord[] = []

  for (const input of inputs) {
    const id = randomUUID()
    const safeName = sanitizeFileName(input.name)
    const fileName = `${id}-${safeName}`
    const absolutePath = path.join(targetDir, fileName)
    const buffer = Buffer.from(input.dataBase64, 'base64')

    await fs.writeFile(absolutePath, buffer)

    const relativePath = path.posix.join('temp', 'photos', dateFolder, fileName)
    records.push({
      id,
      kind: input.kind,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      relativePath,
      absolutePath,
      url: `/${relativePath}`,
      createdAt,
    })
  }

  return records
}
