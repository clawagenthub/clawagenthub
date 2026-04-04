import { getDatabase } from '@/lib/db'
import { generateUserId } from '@/lib/auth/token.js'

async function getTriggerAgentForFlowStart() {
  const module = await import('../../app/api/tickets/[ticketId]/flow/route.js')
  return module.triggerAgentForFlowStart
}

function getSystemUserId(db: ReturnType<typeof getDatabase>): string {
  const workspace = db.prepare('SELECT owner_id FROM workspaces LIMIT 1').get() as { owner_id: string } | undefined
  if (workspace?.owner_id) {
    return workspace.owner_id
  }
  const superuser = db.prepare('SELECT id FROM users WHERE is_superuser = 1 LIMIT 1').get() as { id: string } | undefined
  if (superuser?.id) {
    return superuser.id
  }
  const firstUser = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined
  if (firstUser?.id) {
    return firstUser.id
  }
  return 'system'
}

export async function triggerWaitingTickets(workspaceId: string) {
  const db = getDatabase()
  const systemUserId = getSystemUserId(db)

  const currentFlowingCount = db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE workspace_id = ? AND flowing_status = 'flowing'
  `).get(workspaceId) as { count: number }

  const onflowlimitSetting = db.prepare(`
    SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = 'onflowlimit'
  `).get(workspaceId) as { setting_value: string } | undefined

  const onflowlimit = onflowlimitSetting?.setting_value ? parseInt(onflowlimitSetting.setting_value) : 5

  if (onflowlimit <= 0) {
    console.log(`[WaitingToFlow] Workspace ${workspaceId}: onflowlimit is ${onflowlimit}, skipping`)
    return
  }

  const availableSlots = onflowlimit - currentFlowingCount.count
  if (availableSlots <= 0) {
    console.log(`[WaitingToFlow] Workspace ${workspaceId}: No slots available (${currentFlowingCount.count}/${onflowlimit} flowing)`)
    return
  }

  const waitingTickets = db.prepare(`
    SELECT id, workspace_id FROM tickets
    WHERE workspace_id = ? AND flowing_status = 'waiting_to_flow'
    ORDER BY updated_at ASC
    LIMIT ?
  `).all(workspaceId, availableSlots) as Array<{ id: string; workspace_id: string }>

  console.log(`[WaitingToFlow] Workspace ${workspaceId}: Found ${waitingTickets.length} waiting tickets, ${availableSlots} slots available`)

  for (const ticket of waitingTickets) {
    console.log(`[WaitingToFlow] Triggering flow for ticket ${ticket.id}`)
    const now = new Date().toISOString()
    db.prepare(`
      UPDATE tickets
      SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
      WHERE id = ?
    `).run('flowing', now, now, ticket.id)

    const auditLogId = generateUserId()
    db.prepare(
      `INSERT INTO ticket_audit_logs (
        id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditLogId,
      ticket.id,
      'flow_started',
      systemUserId,
      'system',
      JSON.stringify({ flowing_status: 'waiting_to_flow' }),
      JSON.stringify({ flowing_status: 'flowing', reason: 'Flow slot became available' }),
      now
    )

    const triggerAgentForFlowStart = await getTriggerAgentForFlowStart()
    triggerAgentForFlowStart({
      ticketId: ticket.id,
      workspaceId: ticket.workspace_id,
      userId: systemUserId,
      sessionToken: '',
    })
  }
}
