/**
 * Ticket Flow Idle Timeout Service
 *
 * Monitors agent chat sessions for tickets with enabled flow.
 * When an agent has been idle for 2 minutes after their last message,
 * automatically advance the ticket to the next status in the flow.
 */

import Database from 'better-sqlite3'
import { getDatabase } from '@/lib/db'
import { getGatewayManager } from '@/lib/gateway/manager'
import logger, { logCategories } from '@/lib/logger/index.js'

const IDLE_TIMEOUT_MS = 2 * 60 * 1000
const CHECK_INTERVAL_MS = 30 * 1000

interface TicketWithFlow {
  id: string
  title: string
  workspace_id: string
  status_id: string
  flow_enabled: number
  current_agent_id: string | null
  current_gateway_id: string | null
}

interface ChatMessage {
  id: string
  session_id: string
  created_at: string
  role: string
}

interface FlowConfig {
  status_id: string
  flow_order: number
  agent_id: string | null
  on_failed_goto: string | null
  ask_approve_to_continue: number
}

class IdleTimeoutService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  start() {
    if (this.isRunning) {
      logger.info({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Already running')
      return
    }

    logger.info({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Starting idle timeout detection service')
    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.checkIdleTickets().catch(error => {
        logger.error({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Error checking idle tickets: %s', String(error))
      })
    }, CHECK_INTERVAL_MS)

    this.checkIdleTickets().catch(error => {
      logger.error({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Error in initial check: %s', String(error))
    })
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    logger.info({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Stopped idle timeout detection service')
  }

  private async checkIdleTickets() {
    logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Checking for idle tickets...')
    
    const db = getDatabase()
    const manager = getGatewayManager()

    try {
      const tickets = db
        .prepare(`
          SELECT t.* 
          FROM tickets t
          WHERE t.flow_enabled = 1
            AND t.current_agent_id IS NOT NULL
            AND t.current_gateway_id IS NOT NULL
            AND t.status NOT IN ('finished', 'notinflow', 'idle')
        `)
        .all() as TicketWithFlow[]

      logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Found %s tickets with active flow', tickets.length)

      for (const ticket of tickets) {
        await this.checkTicketIdle(ticket, db, manager)
      }
    } catch (error) {
      logger.error({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Error fetching tickets: %s', String(error))
    }
  }

  private async checkTicketIdle(ticket: TicketWithFlow, db: Database.Database, _manager: ReturnType<typeof getGatewayManager>) {
    try {
      const flowConfigs = db
        .prepare(`
          SELECT * FROM ticket_flow_configs
          WHERE ticket_id = ?
            AND is_included = 1
          ORDER BY flow_order ASC
        `)
        .all(ticket.id) as FlowConfig[]

      if (flowConfigs.length === 0) {
        logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Ticket %s has no flow configs', ticket.id)
        return
      }

      const currentFlowIndex = flowConfigs.findIndex(fc => fc.status_id === ticket.status_id)
      if (currentFlowIndex === -1) {
        logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Ticket %s current status not in flow', ticket.id)
        return
      }

      if (currentFlowIndex >= flowConfigs.length - 1) {
        logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Ticket %s is at last status in flow', ticket.id)
        return
      }

      const currentFlowConfig = flowConfigs[currentFlowIndex]
      if (currentFlowConfig.ask_approve_to_continue) {
        logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Ticket %s requires approval to continue', ticket.id)
        return
      }

      const sessionKey = `agent:${ticket.current_agent_id}:main`
      
      const chatSession = db
        .prepare(`
          SELECT * FROM chat_sessions
          WHERE workspace_id = ?
            AND gateway_id = ?
            AND agent_id = ?
            AND session_key = ?
          ORDER BY updated_at DESC
          LIMIT 1
        `)
        .get(ticket.workspace_id, ticket.current_gateway_id, ticket.current_agent_id, sessionKey) as { id: string; updated_at: string } | undefined

      if (!chatSession) {
        logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'No chat session found for ticket %s', ticket.id)
        return
      }

      const lastMessage = db
        .prepare(`
          SELECT * FROM chat_messages
          WHERE session_id = ?
            AND role = 'assistant'
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .get(chatSession.id) as ChatMessage | undefined

      if (!lastMessage) {
        logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'No messages from agent for ticket %s', ticket.id)
        return
      }

      const lastMessageTime = new Date(lastMessage.created_at).getTime()
      const now = Date.now()
      const idleTime = now - lastMessageTime

      logger.debug({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Ticket %s idle time: %ss', ticket.id, String(Math.round(idleTime / 1000)))

      if (idleTime >= IDLE_TIMEOUT_MS) {
        logger.info({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Ticket %s is idle, advancing flow...', ticket.id)
        await this.advanceTicketFlow(ticket, flowConfigs, currentFlowIndex, db)
      }
    } catch (error) {
      logger.error({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Error checking ticket %s: %s', ticket.id, String(error))
    }
  }

  private async advanceTicketFlow(
    ticket: TicketWithFlow,
    flowConfigs: FlowConfig[],
    currentIndex: number,
    db: Database.Database
  ) {
    try {
      const nextFlowConfig = flowConfigs[currentIndex + 1]
      const now = new Date().toISOString()

      const nextStatus = db
        .prepare('SELECT * FROM statuses WHERE id = ?')
        .get(nextFlowConfig.status_id) as { id: string; name: string } | undefined

      if (!nextStatus) {
        logger.error({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Next status %s not found', nextFlowConfig.status_id)
        return
      }

      db.prepare(`
        UPDATE tickets
        SET status_id = ?,
            current_agent_id = ?,
            current_gateway_id = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        nextFlowConfig.status_id,
        nextFlowConfig.agent_id,
        ticket.current_gateway_id,
        now,
        ticket.id
      )

      db.prepare(`
        INSERT INTO ticket_flow_history (
          id, ticket_id, from_status_id, to_status_id,
          agent_id, gateway_id, transitioned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.generateId(),
        ticket.id,
        ticket.status_id,
        nextFlowConfig.status_id,
        nextFlowConfig.agent_id,
        ticket.current_gateway_id,
        now
      )

      db.prepare(`
        INSERT INTO ticket_audit_logs (
          id, ticket_id, event_type, user_id, old_value, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.generateId(),
        ticket.id,
        'status_changed',
        'system',
        ticket.status_id,
        nextFlowConfig.status_id,
        now
      )

      db.prepare(`
        INSERT INTO ticket_comments (
          id, ticket_id, user_id, content, is_system_comment, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        this.generateId(),
        ticket.id,
        'system',
        `Automatically advanced from previous status to **${nextStatus.name}** due to agent inactivity (2-minute timeout).`,
        1,
        now
      )

      logger.info({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Successfully advanced ticket %s to %s', ticket.id, nextStatus.name)
    } catch (error) {
      logger.error({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Error advancing ticket %s: %s', ticket.id, String(error))
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

let serviceInstance: IdleTimeoutService | null = null

export function getIdleTimeoutService(): IdleTimeoutService {
  if (!serviceInstance) {
    serviceInstance = new IdleTimeoutService()
  }
  return serviceInstance
}

if (typeof window === 'undefined') {
  logger.info({ category: logCategories.IDLE_TIMEOUT_SERVICE }, 'Initializing on server start')
  getIdleTimeoutService().start()
}
