/**
 * Stale Ticket Service
 * 
 * Monitors ticket statuses and automatically transitions tickets to a configurable
 * status when the last comment timestamp exceeds a configurable threshold.
 * 
 * Usage:
 *   import { staleTicketService } from '@/lib/services/stale-ticket.service'
 *   const result = await staleTicketService.checkAndTransitionStaleTickets(workspaceId)
 */

import { getDatabase } from '@/lib/db'
import logger from '@/lib/logger/index.js'

export interface StaleTicketResult {
  success: boolean
  processedTickets: number
  transitionedTickets: number
  errors: string[]
  details: Array<{
    ticketId: string
    ticketNumber: number
    previousStatusId: string
    newStatusId: string
    lastCommentAt: string | null
    thresholdMinutes: number
  }>
}

export interface StaleTicketSettings {
  thresholdMinutes: number
  targetStatus: string
  targetStatusId: string | null
}

const DEFAULT_THRESHOLD_MINUTES = 20
const DEFAULT_TARGET_STATUS = 'waiting'

/**
 * Get a valid system user ID for audit logs and comments
 * Uses workspace owner, superuser, or first available user as fallback
 */
function getSystemUserId(db: ReturnType<typeof getDatabase>): string {
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

export class StaleTicketService {
  /**
   * Get stale ticket settings for a workspace
   */
  async getSettings(workspaceId: string): Promise<StaleTicketSettings> {
    const db = getDatabase()
    
    const settings = db.prepare(`
      SELECT setting_key, setting_value 
      FROM workspace_settings 
      WHERE workspace_id = ? AND setting_key IN ('stale_ticket_threshold_minutes', 'stale_ticket_target_status')
    `).all(workspaceId) as Array<{ setting_key: string; setting_value: string | null }>

    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      if (s.setting_value !== null) {
        settingsMap[s.setting_key] = s.setting_value
      }
    }

    const thresholdMinutes = parseInt(settingsMap['stale_ticket_threshold_minutes'] || String(DEFAULT_THRESHOLD_MINUTES), 10)
    const targetStatus = settingsMap['stale_ticket_target_status'] || DEFAULT_TARGET_STATUS

    // Resolve target status name to status_id
    const targetStatusRow = db.prepare(`
      SELECT id FROM statuses 
      WHERE workspace_id = ? AND LOWER(name) = LOWER(?)
      LIMIT 1
    `).get(workspaceId, targetStatus) as { id: string } | undefined

    return {
      thresholdMinutes: isNaN(thresholdMinutes) ? DEFAULT_THRESHOLD_MINUTES : thresholdMinutes,
      targetStatus,
      targetStatusId: targetStatusRow?.id || null
    }
  }

  /**
   * Get the last comment time for a ticket from the ticket_comments table
   */
  async getLastCommentTime(ticketId: string): Promise<string | null> {
    const db = getDatabase()
    
    const result = db.prepare(`
      SELECT MAX(created_at) as last_comment_at 
      FROM ticket_comments 
      WHERE ticket_id = ?
    `).get(ticketId) as { last_comment_at: string | null } | undefined

    return result?.last_comment_at || null
  }

  /**
   * Get all tickets that should be checked for staleness
   * (flow-enabled, active, and not already at target status)
   */
  async getTicketsToCheck(workspaceId: string, targetStatusId: string): Promise<Array<{
    id: string
    ticket_number: number
    title: string
    status_id: string
    status_name: string
  }>> {
    const db = getDatabase()
    
    const tickets = db.prepare(`
      SELECT t.id, t.ticket_number, t.title, t.status_id, s.name as status_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.workspace_id = ?
        AND t.status_id != ?
        AND t.flow_enabled = 1
        AND t.creation_status = 'active'
    `).all(workspaceId, targetStatusId) as Array<{
      id: string
      ticket_number: number
      title: string
      status_id: string
      status_name: string
    }>

    return tickets
  }

  /**
   * Transition a ticket to the stale target status
   */
  async transitionTicket(
    ticketId: string,
    previousStatusId: string,
    newStatusId: string,
    workspaceId: string
  ): Promise<void> {
    const db = getDatabase()
    const now = new Date().toISOString()
    const timestamp = Date.now()

    // Update ticket status
    db.prepare(`
      UPDATE tickets 
      SET status_id = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatusId, now, ticketId)

    // Get valid system user ID for audit logs and comments
    const systemUserId = getSystemUserId(db)

    // Create audit log entry
    db.prepare(`
      INSERT INTO ticket_audit_logs (id, ticket_id, event_type, actor_id, actor_type, old_value, new_value, created_at)
      VALUES (?, ?, 'status_changed', ?, 'system', ?, ?, ?)
    `).run(
      `stale_cron_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      ticketId,
      systemUserId,
      previousStatusId,
      newStatusId,
      now
    )

    // Create system comment
    const previousStatus = db.prepare('SELECT name FROM statuses WHERE id = ?').get(previousStatusId) as { name: string } | undefined
    const newStatus = db.prepare('SELECT name FROM statuses WHERE id = ?').get(newStatusId) as { name: string } | undefined

    db.prepare(`
      INSERT INTO ticket_comments (id, ticket_id, content, created_by, created_at, updated_at, is_agent_completion_signal)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(
      `stale_comment_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      ticketId,
      `Automatically moved from **${previousStatus?.name || previousStatusId}** to **${newStatus?.name || newStatusId}** due to no comments within the configured threshold.`,
      systemUserId,
      now,
      now
    )

    logger.debug(`[StaleTicket] Transitioned ticket ${ticketId} from ${previousStatusId} to ${newStatusId}`)
  }

  /**
   * Main function to check and transition stale tickets
   * Called by the cron API endpoint
   */
  async checkAndTransitionStaleTickets(workspaceId: string): Promise<StaleTicketResult> {
    const result: StaleTicketResult = {
      success: true,
      processedTickets: 0,
      transitionedTickets: 0,
      errors: [],
      details: []
    }

    try {
      // Get settings
      const settings = await this.getSettings(workspaceId)

      // If threshold is 0 or disabled, skip
      if (settings.thresholdMinutes <= 0) {
        logger.debug('[StaleTicket] Threshold is 0, skipping')
        return result
      }

      // If target status not found, log error and stop
      if (!settings.targetStatusId) {
        logger.warn(`[StaleTicket] Target status "${settings.targetStatus}" not found for workspace ${workspaceId}`)
        result.errors.push(`Target status "${settings.targetStatus}" not found`)
        result.success = false
        return result
      }

      // Get tickets to check
      const tickets = await this.getTicketsToCheck(workspaceId, settings.targetStatusId)
      result.processedTickets = tickets.length

      logger.debug(`[StaleTicket] Checking ${tickets.length} tickets for staleness (threshold: ${settings.thresholdMinutes} minutes)`)

      const thresholdMs = settings.thresholdMinutes * 60 * 1000
      const now = Date.now()

      for (const ticket of tickets) {
        try {
          // Get last comment time for this ticket
          const lastCommentAt = await this.getLastCommentTime(ticket.id)

          // If no comments, skip
          if (!lastCommentAt) {
            logger.debug(`[StaleTicket] Ticket ${ticket.id} has no comments, skipping`)
            continue
          }

          // Check if threshold exceeded
          const lastCommentMs = new Date(lastCommentAt).getTime()
          const diffMs = now - lastCommentMs

          if (diffMs >= thresholdMs) {
            // Transition ticket
            await this.transitionTicket(
              ticket.id,
              ticket.status_id,
              settings.targetStatusId,
              workspaceId
            )

            result.transitionedTickets++
            result.details.push({
              ticketId: ticket.id,
              ticketNumber: ticket.ticket_number,
              previousStatusId: ticket.status_id,
              newStatusId: settings.targetStatusId,
              lastCommentAt,
              thresholdMinutes: settings.thresholdMinutes
            })

            logger.info(`[StaleTicket] Ticket #${ticket.ticket_number} transitioned to "${settings.targetStatus}" (idle: ${Math.round(diffMs / 60000)} minutes)`)
          }
        } catch (error) {
          const errorMsg = `Error processing ticket ${ticket.id}: ${String(error)}`
          logger.error(`[StaleTicket] ${errorMsg}`)
          result.errors.push(errorMsg)
        }
      }

      logger.info(`[StaleTicket] Completed: ${result.transitionedTickets}/${tickets.length} tickets transitioned`)
    } catch (error) {
      const errorMsg = `Critical error in stale ticket check: ${String(error)}`
      logger.error(`[StaleTicket] ${errorMsg}`)
      result.errors.push(errorMsg)
      result.success = false
    }

    return result
  }

  /**
   * Get all workspaces that have stale ticket cron enabled
   * Used by the cron handler to iterate across all workspaces
   */
  async getWorkspacesWithStaleCronEnabled(): Promise<string[]> {
    const db = getDatabase()
    
    // Get all workspaces that have the stale ticket settings configured
    // (threshold > 0 means enabled)
    const workspaces = db.prepare(`
      SELECT DISTINCT ws.workspace_id 
      FROM workspace_settings ws
      WHERE ws.setting_key = 'stale_ticket_threshold_minutes'
        AND ws.setting_value IS NOT NULL
        AND CAST(ws.setting_value AS INTEGER) > 0
    `).all() as Array<{ workspace_id: string }>

    return workspaces.map(w => w.workspace_id)
  }
}

// Singleton export
export const staleTicketService = new StaleTicketService()
