import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getUserWithWorkspace, unauthorizedResponse } from '@/lib/auth/api-auth'
import { storeAttachments, type StoredAttachmentInput } from '@/lib/attachments'
import logger, { logCategories } from '@/lib/logger/index.js'


export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserWithWorkspace()
    if (!auth) {
      return unauthorizedResponse('Unauthorized or no workspace selected')
    }

    const db = getDatabase()
    const ticketId = params.id

    const ticket = db
      .prepare('SELECT id, workspace_id, description FROM tickets WHERE id = ? AND workspace_id = ?')
      .get(ticketId, auth.workspaceId) as { id: string; workspace_id: string; description: string | null } | undefined

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const body = await request.json()
    const attachments = Array.isArray(body?.attachments) ? body.attachments : []

    if (!attachments.length) {
      return NextResponse.json({ error: 'No attachments provided' }, { status: 400 })
    }

    const normalized = attachments.map((attachment: any) => ({
      name: String(attachment?.name || 'attachment'),
      mimeType: String(attachment?.mimeType || 'application/octet-stream'),
      size: Number(attachment?.size || 0),
      kind: attachment?.kind === 'image' || attachment?.kind === 'pdf' ? attachment.kind : 'file',
      dataBase64: String(attachment?.dataBase64 || ''),
    })) as StoredAttachmentInput[]

    for (const attachment of normalized) {
      if (!attachment.dataBase64) {
        return NextResponse.json({ error: `Attachment ${attachment.name} is missing data` }, { status: 400 })
      }
    }

    const stored = await storeAttachments(normalized)

    const existingDescription = ticket.description || ''
    const attachmentSection = [
      '',
      'Attachments:',
      ...stored.map((file) => `- [${file.name}](${file.url})`),
    ].join('\n')

    const nextDescription = `${existingDescription.replace(/\s+$/, '')}${attachmentSection}`.trim()
    const now = new Date().toISOString()

    db.prepare('UPDATE tickets SET description = ?, updated_at = ? WHERE id = ?').run(nextDescription, now, ticketId)

    return NextResponse.json({
      attachments: stored,
      description: nextDescription,
    })
  } catch (error) {
    logger.error('[Ticket Attachments API] Error saving attachments:', error)
    return NextResponse.json(
      { error: 'Failed to save attachments' },
      { status: 500 }
    )
  }
}
