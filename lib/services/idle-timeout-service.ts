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

const IDLE_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes
const CHECK_INTERVAL_MS = 30 * 1000 // Check every 30 seconds

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
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  start() {
    if (this.isRunning) {
      console.log('[IdleTimeoutService] Already running')
      return
    }

    console.log('[IdleTimeoutService] Starting idle timeout detection service')
    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.checkIdleTickets().catch(error => {
        console.error('[IdleTimeoutService] Error checking idle tickets:', error)
      })
    }, CHECK_INTERVAL_MS)

    // Run once immediately on start
    this.checkIdleTickets().catch(error => {
      console.error('[IdleTimeoutService] Error in initial check:', error)
    })
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('[IdleTimeoutService] Stopped idle timeout detection service')
  }

  private async checkIdleTickets() {
    console.log('[IdleTimeoutService] Checking for idle tickets...')
    
    const db = getDatabase()
    const manager = getGatewayManager()

    try {
      // Get all tickets with flow enabled and an assigned agent
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

      console.log(`[IdleTimeoutService] Found ${tickets.length} tickets with active flow`)

      for (const ticket of tickets) {
        await this.checkTicketIdle(ticket, db, manager)
      }
    } catch (error) {
      console.error('[IdleTimeoutService] Error fetching tickets:', error)
    }
  }

  private async checkTicketIdle(ticket: TicketWithFlow, db: Database.Database, manager: ReturnType<typeof getGatewayManager>) {
    try {
      // Get the current flow config for this ticket
      const flowConfigs = db
        .prepare(`
          SELECT * FROM ticket_flow_configs
          WHERE ticket_id = ?
            AND is_included = 1
          ORDER BY flow_order ASC
        `)
        .all(ticket.id) as FlowConfig[]

      if (flowConfigs.length === 0) {
        console.log(`[IdleTimeoutService] Ticket ${ticket.id} has no flow configs`)
        return
      }

      // Find current status in flow
      const currentFlowIndex = flowConfigs.findIndex(fc => fc.status_id === ticket.status_id)
      if (currentFlowIndex === -1) {
        console.log(`[IdleTimeoutService] Ticket ${ticket.id} current status not in flow`)
        return
      }

      // Check if there's a next status
      if (currentFlowIndex >= flowConfigs.length - 1) {
        console.log(`[IdleTimeoutService] Ticket ${ticket.id} is at last status in flow`)
        return
      }

      // Check if current status requires approval
      const currentFlowConfig = flowConfigs[currentFlowIndex]
      if (currentFlowConfig.ask_approve_to_continue) {
        console.log(`[IdleTimeoutService] Ticket ${ticket.id} requires approval to continue`)
        return
      }

      // Get the most recent message from the agent in this ticket's session
      const sessionKey = `agent:${ticket.current_agent_id}:main`
      
      // Find the chat session for this agent
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
        console.log(`[IdleTimeoutService] No chat session found for ticket ${ticket.id}`)
        return
      }

      // Get the last message from the agent
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
        console.log(`[IdleTimeoutService] No messages from agent for ticket ${ticket.id}`)
        return
      }

      // Check if the last message is old enough
      const lastMessageTime = new Date(lastMessage.created_at).getTime()
      const now = Date.now()
      const idleTime = now - lastMessageTime

      console.log(`[IdleTimeoutService] Ticket ${ticket.id} idle time: ${Math.round(idleTime / 1000)}s`)

      if (idleTime >= IDLE_TIMEOUT_MS) {
        console.log(`[IdleTimeoutService] Ticket ${ticket.id} is idle, advancing flow...`)
        await this.advanceTicketFlow(ticket, flowConfigs, currentFlowIndex, db)
      }
    } catch (error) {
      console.error(`[IdleTimeoutService] Error checking ticket ${ticket.id}:`, error)
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

      // Get the next status details
      const nextStatus = db
        .prepare('SELECT * FROM statuses WHERE id = ?')
        .get(nextFlowConfig.status_id) as { id: string; name: string } | undefined

      if (!nextStatus) {
        console.error(`[IdleTimeoutService] Next status ${nextFlowConfig.status_id} not found`)
        return
      }

      // Update ticket status
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

      // Record flow history
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

      // Create audit log entry
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

      // Add system comment about automatic flow advancement
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

      console.log(`[IdleTimeoutService] Successfully advanced ticket ${ticket.id} to ${nextStatus.name}`)
    } catch (error) {
      console.error(`[IdleTimeoutService] Error advancing ticket ${ticket.id}:`, error)
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Singleton instance
let serviceInstance: IdleTimeoutService | null = null

export function getIdleTimeoutService(): IdleTimeoutService {
  if (!serviceInstance) {
    serviceInstance = new IdleTimeoutService()
  }
  return serviceInstance
}

// Start the service when the module is imported (only on server)
if (typeof window === 'undefined') {
  console.log('[IdleTimeoutService] Initializing on server start')
  getIdleTimeoutService().start()
}
