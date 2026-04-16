import { getDatabase } from '@/lib/db'
import { generateUserId } from '@/lib/auth/token.js'
import { triggerAgentForFlowStart } from '../../app/api/tickets/[ticketId]/flow/lib/trigger-agent'
import { createSession } from '@/lib/auth/session.js'
import logger, { logCategories } from '@/lib/logger/index.js'

function getSystemUserId(db: ReturnType<typeof getDatabase>): string {
  const workspace = db
    .prepare('SELECT owner_id FROM workspaces LIMIT 1')
    .get() as { owner_id: string } | undefined
  if (workspace?.owner_id) {
    return workspace.owner_id
  }
  const superuser = db
    .prepare('SELECT id FROM users WHERE is_superuser = 1 LIMIT 1')
    .get() as { id: string } | undefined
  if (superuser?.id) {
    return superuser.id
  }
  const firstUser = db.prepare('SELECT id FROM users LIMIT 1').get() as
    | { id: string }
    | undefined
  if (firstUser?.id) {
    return firstUser.id
  }
  return 'system'
}

export async function triggerWaitingTickets(workspaceId: string) {
  const db = getDatabase()
  const systemUserId = getSystemUserId(db)

  const currentFlowingCount = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM tickets WHERE workspace_id = ? AND flowing_status = 'flowing'
  `
    )
    .get(workspaceId) as { count: number }

  const onflowlimitSetting = db
    .prepare(
      `
    SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = 'onflowlimit'
  `
    )
    .get(workspaceId) as { setting_value: string } | undefined

  const onflowlimit = onflowlimitSetting?.setting_value
    ? parseInt(onflowlimitSetting.setting_value)
    : 5

  if (onflowlimit <= 0) {
    logger.info(
      { category: logCategories.WAITING_TO_FLOW_SERVICE },
      'Workspace %s: onflowlimit is %s, skipping',
      workspaceId,
      String(onflowlimit)
    )
    return
  }

  const availableSlots = onflowlimit - currentFlowingCount.count
  if (availableSlots <= 0) {
    logger.info(
      { category: logCategories.WAITING_TO_FLOW_SERVICE },
      'Workspace %s: No slots available (%s/%s flowing)',
      workspaceId,
      String(currentFlowingCount.count),
      String(onflowlimit)
    )
    return
  }

  const waitingTickets = db
    .prepare(
      `
    SELECT id, workspace_id FROM tickets
    WHERE workspace_id = ? AND flowing_status = 'waiting_to_flow'
    ORDER BY updated_at ASC
    LIMIT ?
  `
    )
    .all(workspaceId, availableSlots) as Array<{
    id: string
    workspace_id: string
  }>

  logger.info(
    { category: logCategories.WAITING_TO_FLOW_SERVICE },
    'Workspace %s: Found %s waiting tickets, %s slots available',
    workspaceId,
    String(waitingTickets.length),
    String(availableSlots)
  )

  for (const ticket of waitingTickets) {
    logger.info(
      { category: logCategories.WAITING_TO_FLOW_SERVICE },
      'Triggering flow for ticket %s',
      ticket.id
    )
    const now = new Date().toISOString()
    db.prepare(
      `
      UPDATE tickets
      SET flowing_status = ?, last_flow_check_at = ?, updated_at = ?
      WHERE id = ?
    `
    ).run('flowing', now, now, ticket.id)

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
      JSON.stringify({
        flowing_status: 'flowing',
        reason: 'Flow slot became available',
      }),
      now
    )

    // Create a session for system user to use for API auth in flow prompts
    let systemSession: ReturnType<typeof createSession>
    try {
      systemSession = createSession(systemUserId, 'system-flow-trigger', {
        workspaceId,
      })
    } catch (error) {
      logger.error(
        { category: logCategories.WAITING_TO_FLOW_SERVICE },
        '[waiting-to-flow-trigger] Failed to create system session for ticket %s in workspace %s: %s',
        ticket.id,
        workspaceId,
        String(error)
      )
      continue
    }

    const systemSessionRow = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(systemSession.token) as
      | { current_workspace_id: string | null }
      | undefined

    logger.info(
      { category: logCategories.WAITING_TO_FLOW_SERVICE },
      '[waiting-to-flow-trigger] System session diagnostics: userId=%s workspaceFromSession=%s targetWorkspace=%s tokenPreview=%s...',
      systemUserId,
      systemSessionRow?.current_workspace_id ?? 'null',
      workspaceId,
      systemSession.token.substring(0, 8)
    )

    try {
      await triggerAgentForFlowStart({
        ticketId: ticket.id,
        workspaceId: ticket.workspace_id,
        userId: systemUserId,
        sessionToken: systemSession.token,
      })
    } catch (error) {
      logger.error(
        { category: logCategories.WAITING_TO_FLOW_SERVICE },
        '[waiting-to-flow-trigger] triggerAgentForFlowStart failed for ticket %s in workspace %s: %s',
        ticket.id,
        workspaceId,
        String(error)
      )
    }
  }
}
