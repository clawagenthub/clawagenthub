import type { Ticket, TicketFlowHistory, Status } from '@/lib/db/schema.js'

/**
 * Result parsed from agent flow response
 */
export interface AgentFlowResult {
  result: 'finished' | 'failed' | 'pause'
  notes: string
  progressComment: string
}

/**
 * Client match found for an agent
 */
export interface AgentClientMatch {
  client: {
    isConnected: () => boolean
    listAgents: () => Promise<Array<{ id: string; name?: string; model?: unknown }>>
    sendChatMessageAndWait: (sessionKey: string, prompt: string, opts: { timeoutMs: number }) => Promise<{
      message?: unknown
      error?: string
    }>
  }
  gatewayId: string
  gatewayName: string
  agentModel?: unknown
  agentName?: string
}

/**
 * Parameters for building flow prompt
 */
export interface BuildFlowPromptParams {
  ticket: Ticket
  currentStatus: Status
  agentId: string
  statusInstructions: string | null
  recentComments: Array<{ id: string; content: string; created_at: string; email: string }>
  workspaceId: string
  hasVisionCapability?: boolean
  sessionToken: string
}

/**
 * Route params interface
 */
export interface RouteParams {
  params: Promise<{ ticketId: string }>
}

/**
 * Flow config with status info
 */
export interface FlowConfigWithStatus {
  id: string
  status_id: string
  status_name: string
  status_color: string
  flow_order: number
  agent_id: string | null
  on_failed_goto: string | null
  ask_approve_to_continue: boolean
  is_included: boolean
}

/**
 * Request body for flow POST
 */
export interface FlowPostBody {
  action?: 'start' | 'stop' | 'pause'
  result?: 'finished' | 'failed' | 'pause'
  notes?: string
}
