/**
 * Flow Auto-Finish Service (Variant B)
 *
 * This service provides CONTROLLABLE auto-finish logic for tickets.
 * Advantages over trigger approach:
 * - Full logging and debugging capability
 * - Unit testable
 * - Can add conditional logic
 * - Easy to disable without DB changes
 * - Can integrate with external systems on finish
 *
 * Usage:
 *   import { flowAutoFinishService } from '@/lib/services/flow-auto-finish.service'
 *   const result = await flowAutoFinishService.checkAndAutoFinishTicket(ticketId)
 */

import { getDatabase } from '@/lib/db'
import type { TicketFlowingStatus } from '@/lib/db/schema'
import logger from '@/lib/logger/index.js'

export interface AutoFinishResult {
  wasFinished: boolean
  completedSteps: number
  totalSteps: number
  finishedStatusId: string | null
  ticketId: string
  timestamp: string
}

export interface FlowDependencyResult {
  canFlow: boolean
  waitingTicketId: string | null
  waitingTicketStatus: TicketFlowingStatus | null
  message: string
}

export class FlowAutoFinishService {
  private readonly FINISHED_STATUS_NAMES = ['Finished', 'Completed', 'Done']

  /**
   * Check if all flow steps are completed and auto-update status to Finished
   * @param ticketId - The ticket to check
   * @returns AutoFinishResult with details about the operation
   */
  async checkAndAutoFinishTicket(ticketId: string): Promise<AutoFinishResult> {
    const db = getDatabase()
    const timestamp = new Date().toISOString()

    logger.debug(
      `[FlowAutoFinish] Checking auto-finish for ticket ${ticketId} at ${timestamp}`
    )

    // Step 1: Get total flow steps for this ticket (only included ones)
    const totalStepsResult = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM ticket_flow_configs 
      WHERE ticket_id = ? AND is_included = 1
    `
      )
      .get(ticketId) as { count: number } | undefined

    const totalSteps = totalStepsResult?.count ?? 0
    logger.debug(`[FlowAutoFinish] Total included flow steps: ${totalSteps}`)

    // Edge case: No flow steps configured - don't auto-finish
    if (totalSteps === 0) {
      logger.debug(
        `[FlowAutoFinish] Ticket ${ticketId} has no flow steps configured, skipping`
      )
      return {
        wasFinished: false,
        completedSteps: 0,
        totalSteps: 0,
        finishedStatusId: null,
        ticketId,
        timestamp,
      }
    }

    // Step 2: Get count of completed flow steps
    const completedStepsResult = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM ticket_flow_history 
      WHERE ticket_id = ? AND flow_result = 'completed'
    `
      )
      .get(ticketId) as { count: number } | undefined

    const completedSteps = completedStepsResult?.count ?? 0
    logger.debug(
      `[FlowAutoFinish] Completed flow steps: ${completedSteps}/${totalSteps}`
    )

    // Step 3: Check if all steps are completed
    if (completedSteps < totalSteps) {
      logger.debug(
        `[FlowAutoFinish] Ticket ${ticketId} not ready for auto-finish (${completedSteps}/${totalSteps})`
      )
      return {
        wasFinished: false,
        completedSteps,
        totalSteps,
        finishedStatusId: null,
        ticketId,
        timestamp,
      }
    }

    // Step 4: Get the "Finished" status ID (lookup by name, don't hardcode)
    const placeholders = this.FINISHED_STATUS_NAMES.map(() => '?').join(', ')
    const finishedStatus = db
      .prepare(
        `
      SELECT id FROM statuses 
      WHERE name IN (${placeholders})
      ORDER BY priority DESC
      LIMIT 1
    `
      )
      .get(...this.FINISHED_STATUS_NAMES) as { id: string } | undefined

    if (!finishedStatus) {
      logger.warn(
        `[FlowAutoFinish] No "Finished" status found in statuses table`
      )
      return {
        wasFinished: false,
        completedSteps,
        totalSteps,
        finishedStatusId: null,
        ticketId,
        timestamp,
      }
    }

    logger.debug(`[FlowAutoFinish] Found Finished status: ${finishedStatus.id}`)

    // Step 5: Update ticket to Finished (only if not already finished)
    const updateResult = db
      .prepare(
        `
      UPDATE tickets 
      SET 
        status_id = ?,
        flowing_status = 'completed',
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
        AND flowing_status NOT IN ('completed', 'finished')
    `
      )
      .run(finishedStatus.id, ticketId)

    if (updateResult.changes === 0) {
      logger.debug(
        `[FlowAutoFinish] Ticket ${ticketId} was already finished or update not needed`
      )
      return {
        wasFinished: false,
        completedSteps,
        totalSteps,
        finishedStatusId: finishedStatus.id,
        ticketId,
        timestamp,
      }
    }

    logger.debug(
      `[FlowAutoFinish] ✅ Ticket ${ticketId} auto-finished! Status updated to: ${finishedStatus.id}`
    )

    // Log to audit trail
    try {
      db.prepare(
        `
        INSERT INTO ticket_audit_logs (id, ticket_id, event_type, old_value, new_value, created_by)
        VALUES (?, ?, 'auto_finished', NULL, ?, 'system')
      `
      ).run(
        `auto_finish_${Date.now()}`,
        ticketId,
        JSON.stringify({
          finishedStatusId: finishedStatus.id,
          completedSteps,
          totalSteps,
          autoFinishedAt: timestamp,
        })
      )
    } catch (error) {
      logger.error(
        `[FlowAutoFinish] Failed to log auto-finish to audit:`,
        error
      )
    }

    return {
      wasFinished: true,
      completedSteps,
      totalSteps,
      finishedStatusId: finishedStatus.id,
      ticketId,
      timestamp,
    }
  }

  /**
   * Called after each flow step execution completes
   * This is the main integration point with the flow executor
   *
   * @param ticketId - The ticket whose flow step just completed
   */
  async afterFlowStepComplete(ticketId: string): Promise<AutoFinishResult> {
    logger.debug(
      `[FlowAutoFinish] Flow step completed for ticket ${ticketId}, checking auto-finish...`
    )
    return this.checkAndAutoFinishTicket(ticketId)
  }

  /**
   * Check if a ticket is eligible to start flowing
   * A ticket cannot flow if it has a waiting_finished_ticket_id that is not yet finished
   *
   * @param ticketId - The ticket to check
   * @returns FlowDependencyResult indicating if ticket can flow
   */
  async checkFlowDependency(ticketId: string): Promise<FlowDependencyResult> {
    const db = getDatabase()

    const ticket = db
      .prepare(
        `
      SELECT id, waiting_finished_ticket_id, flowing_status
      FROM tickets
      WHERE id = ?
    `
      )
      .get(ticketId) as
      | {
          id: string
          waiting_finished_ticket_id: string | null
          flowing_status: TicketFlowingStatus
        }
      | undefined

    if (!ticket) {
      logger.warn(
        `[FlowAutoFinish] Ticket ${ticketId} not found for flow dependency check`
      )
      return {
        canFlow: false,
        waitingTicketId: null,
        waitingTicketStatus: null,
        message: `Ticket ${ticketId} not found`,
      }
    }

    // No dependency - can flow freely
    if (!ticket.waiting_finished_ticket_id) {
      return {
        canFlow: true,
        waitingTicketId: null,
        waitingTicketStatus: null,
        message: 'No flow dependency',
      }
    }

    // Check if the waiting ticket is finished
    const waitingTicket = db
      .prepare(
        `
      SELECT id, flowing_status FROM tickets WHERE id = ?
    `
      )
      .get(ticket.waiting_finished_ticket_id) as
      | {
          id: string
          flowing_status: TicketFlowingStatus
        }
      | undefined

    if (!waitingTicket) {
      logger.warn(
        `[FlowAutoFinish] Waiting ticket ${ticket.waiting_finished_ticket_id} not found`
      )
      return {
        canFlow: true,
        waitingTicketId: ticket.waiting_finished_ticket_id,
        waitingTicketStatus: null,
        message: 'Waiting ticket not found, allowing flow',
      }
    }

    const isWaitingFinished = waitingTicket.flowing_status === 'completed'

    if (isWaitingFinished) {
      return {
        canFlow: true,
        waitingTicketId: ticket.waiting_finished_ticket_id,
        waitingTicketStatus: waitingTicket.flowing_status,
        message: 'Dependency ticket is finished, can flow',
      }
    } else {
      return {
        canFlow: false,
        waitingTicketId: ticket.waiting_finished_ticket_id,
        waitingTicketStatus: waitingTicket.flowing_status,
        message: `Waiting on ticket ${ticket.waiting_finished_ticket_id} to finish (current status: ${waitingTicket.flowing_status})`,
      }
    }
  }

  /**
   * Get all tickets that are waiting on a specific ticket to finish
   * Useful for cascade updates when a ticket finishes
   *
   * @param finishedTicketId - The ticket that just finished
   * @returns Array of ticket IDs that were waiting on this ticket
   */
  async getTicketsWaitingOn(finishedTicketId: string): Promise<string[]> {
    const db = getDatabase()

    const waitingTickets = db
      .prepare(
        `
      SELECT id FROM tickets 
      WHERE waiting_finished_ticket_id = ?
        AND flowing_status = 'waiting'
    `
      )
      .all(finishedTicketId) as Array<{ id: string }>

    return waitingTickets.map((t) => t.id)
  }

  /**
   * Update waiting tickets when a dependency finishes
   * Moves tickets from 'waiting' to 'waiting_to_flow' state
   *
   * @param finishedTicketId - The ticket that just finished
   * @returns Number of tickets updated
   */
  async updateWaitingTickets(finishedTicketId: string): Promise<number> {
    const db = getDatabase()

    const result = db
      .prepare(
        `
      UPDATE tickets 
      SET flowing_status = 'waiting_to_flow', updated_at = datetime('now')
      WHERE waiting_finished_ticket_id = ?
        AND flowing_status = 'waiting'
    `
      )
      .run(finishedTicketId)

    logger.debug(
      `[FlowAutoFinish] Updated ${result.changes} waiting tickets after ${finishedTicketId} finished`
    )
    return result.changes
  }
}

// Singleton export
export const flowAutoFinishService = new FlowAutoFinishService()
