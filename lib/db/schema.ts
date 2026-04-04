export interface User {
  id: string
  email: string
  password_hash: string
  is_superuser: boolean
  first_password_changed: boolean
  created_at: string
  updated_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  summarizer_agent_id: string | null
  summarizer_gateway_id: string | null
  auto_summary_enabled: boolean
  idle_timeout_minutes: number
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string
  token: string
  current_workspace_id: string | null
  expires_at: string
  created_at: string
}

export interface SetupToken {
  id: string
  token: string
  used: boolean
  expires_at: string
  created_at: string
}

export interface Migration {
  id: number
  name: string
  applied_at: string
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

// Workspace settings (key-value store for workspace-level configuration)
export interface WorkspaceSetting {
  id: string
  workspace_id: string
  setting_key: string
  setting_value: string | null
  created_at: string
  updated_at: string
}

export interface WorkspaceSettingInsert {
  workspace_id: string
  setting_key: string
  setting_value?: string | null
}

export interface WorkspaceSettingUpdate {
  setting_value?: string | null
}

export interface WorkspaceWithRole extends Workspace {
  role: 'owner' | 'admin' | 'member'
  member_count?: number
}

export interface Gateway {
  id: string
  workspace_id: string
  name: string
  url: string
  auth_token: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  last_connected_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

// Status types for workspace statuses with flow properties
export interface Status {
  id: string
  name: string
  color: string
  description: string | null
  workspace_id: string
  priority: number
  agent_id: string | null
  on_failed_goto: string | null
  is_flow_included: boolean
  ask_approve_to_continue: boolean
  instructions_override: string | null
  is_system_status: boolean
  created_at: string
  updated_at: string
}

export interface StatusInsert {
  name: string
  color: string
  description?: string | null
  workspace_id: string
  priority?: number
  agent_id?: string | null
  on_failed_goto?: string | null
  is_flow_included?: boolean
  ask_approve_to_continue?: boolean
  instructions_override?: string | null
  is_system_status?: boolean
}

export interface StatusUpdate {
  name?: string
  color?: string
  description?: string | null
  priority?: number
  agent_id?: string | null
  on_failed_goto?: string | null
  is_flow_included?: boolean
  ask_approve_to_continue?: boolean
  instructions_override?: string | null
  is_system_status?: boolean
}

// Ticket creation status type
export type TicketCreationStatus = 'draft' | 'active'
export type TicketFlowingStatus = 'stopped' | 'flowing' | 'waiting' | 'waiting_to_flow' | 'failed' | 'completed'
export type TicketFlowMode = 'manual' | 'automatic'

// Ticket types
export interface Ticket {
  id: string
  workspace_id: string
  ticket_number: number
  title: string
  description: string | null
  status_id: string
  created_by: string
  assigned_to: string | null
  flow_enabled: boolean
  flowing_status: TicketFlowingStatus
  flow_mode: TicketFlowMode
  current_agent_session_id: string | null
  last_flow_check_at: string | null
  completed_at: string | null
  creation_status: TicketCreationStatus
  created_at: string
  updated_at: string
}

export interface TicketInsert {
  workspace_id: string
  ticket_number: number
  title: string
  description?: string | null
  status_id: string
  created_by: string
  assigned_to?: string | null
  flow_enabled?: boolean
  flowing_status?: TicketFlowingStatus
  flow_mode?: TicketFlowMode
  creation_status?: TicketCreationStatus
}

export interface TicketUpdate {
  title?: string
  description?: string | null
  status_id?: string
  assigned_to?: string | null
  flow_enabled?: boolean
  flowing_status?: TicketFlowingStatus
  flow_mode?: TicketFlowMode
  current_agent_session_id?: string | null
  last_flow_check_at?: string | null
  completed_at?: string | null
  creation_status?: TicketCreationStatus
}

// Ticket flow configuration (ticket-specific overrides)
export interface TicketFlowConfig {
  id: string
  ticket_id: string
  status_id: string
  flow_order: number
  agent_id: string | null
  on_failed_goto: string | null
  ask_approve_to_continue: boolean
  instructions_override: string | null
  is_included: boolean
  created_at: string
  updated_at: string
}

export interface TicketFlowConfigInsert {
  ticket_id: string
  status_id: string
  flow_order: number
  agent_id?: string | null
  on_failed_goto?: string | null
  ask_approve_to_continue?: boolean
  instructions_override?: string | null
  is_included?: boolean
}

export interface TicketFlowConfigUpdate {
  flow_order?: number
  agent_id?: string | null
  on_failed_goto?: string | null
  ask_approve_to_continue?: boolean
  instructions_override?: string | null
  is_included?: boolean
}

// Combined status with ticket flow config for API responses
export interface TicketFlowStatus {
  status: Status
  config: TicketFlowConfig
}

// Ticket comments
export interface TicketComment {
  id: string
  ticket_id: string
  content: string
  created_by: string
  created_at: string
  updated_at: string
  is_agent_completion_signal: boolean
}

export interface TicketCommentInsert {
  ticket_id: string
  content: string
  created_by: string
  is_agent_completion_signal?: boolean
}

export interface TicketCommentUpdate {
  content?: string
  is_agent_completion_signal?: boolean
}

// Audit log types
export type AuditEventType =
  | 'status_changed'
  | 'created'
  | 'updated'
  | 'comment_added'
  | 'comment_updated'
  | 'comment_deleted'
  | 'flow_transition'
  | 'agent_assigned'
  | 'flow_started'
  | 'flow_completed'
  | 'flow_failed'
  | 'flow_stopped'
  | 'flow_restarted'

export type ActorType = 'user' | 'agent' | 'system'

export interface TicketAuditLog {
  id: string
  ticket_id: string
  event_type: AuditEventType
  actor_id: string
  actor_type: ActorType
  old_value: string | null
  new_value: string | null
  metadata: string | null
  created_at: string
}

export interface TicketAuditLogInsert {
  ticket_id: string
  event_type: AuditEventType
  actor_id: string
  actor_type?: ActorType
  old_value?: string | null
  new_value?: string | null
  metadata?: string | null
}

// Ticket flow history
export type FlowResult = 'success' | 'failed' | 'skipped' | 'manual'

export interface TicketFlowHistory {
  id: string
  ticket_id: string
  from_status_id: string | null
  to_status_id: string
  agent_id: string | null
  session_id: string | null
  flow_result: FlowResult
  failure_reason: string | null
  notes: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface TicketFlowHistoryInsert {
  ticket_id: string
  from_status_id?: string | null
  to_status_id: string
  agent_id?: string | null
  session_id?: string | null
  flow_result: FlowResult
  failure_reason?: string | null
  notes?: string | null
  started_at: string
  completed_at?: string | null
}

// Workspace ticket sequence
export interface WorkspaceTicketSequence {
  workspace_id: string
  next_ticket_number: number
}

// System status constants
export const SYSTEM_STATUSES = {
  IDLE: 'idle',
  ONLINE: 'online',
  FINISHED: 'finished',
  NOT_IN_FLOW: 'notinflow'
} as const

export type SystemStatus = typeof SYSTEM_STATUSES[keyof typeof SYSTEM_STATUSES]

// Chat types
export type SessionStatus = 'active' | 'idle' | 'inactive'

export interface MCPActivity {
  tool: string
  action: string
}

export interface ChatSession {
  id: string
  workspace_id: string
  user_id: string
  gateway_id: string
  agent_id: string
  agent_name: string
  session_key: string // Format: agent:{agentId}:{scopeOrSessionId}
  status: SessionStatus
  last_activity_at: string
  is_typing: number // SQLite boolean (0 or 1)
  mcp_activity: string | null // JSON string
  title: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string // JSON array of content blocks
  metadata: string | null // JSON for additional data
  created_at: string
}

// Skill source types
export type SkillSource = 'custom' | 'skillsmp' | 'imported'

// Skills table
export interface Skill {
  id: string
  workspace_id: string
  skill_name: string
  skill_description: string | null
  skill_data: string // Markdown content (SKILL.md format)
  source: SkillSource
  external_id: string | null
  tags: string | null // JSON array
  path: string | null // Relative path to local SKILL.md file
  is_content_from_path: boolean // If true, read content from path; otherwise use skill_data
  github_url: string | null // GitHub repository URL
  skill_url: string | null // SkillsMP marketplace URL
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface SkillInsert {
  workspace_id: string
  skill_name: string
  skill_description?: string | null
  skill_data: string
  source?: SkillSource
  external_id?: string | null
  tags?: string | null
  path?: string | null
  is_content_from_path?: boolean
  github_url?: string | null
  skill_url?: string | null
  is_active?: boolean
  created_by?: string | null
}

export interface SkillUpdate {
  skill_name?: string
  skill_description?: string | null
  skill_data?: string
  tags?: string | null
  is_active?: boolean
}

// Status-Skills junction table
export interface StatusSkill {
  id: string
  status_id: string
  skill_id: string
  priority: number
  created_at: string
}

export interface StatusSkillInsert {
  status_id: string
  skill_id: string
  priority?: number
}

// Extended types for API responses
export interface SkillWithMetadata extends Skill {
  status_count?: number // Number of statuses using this skill
  created_by_email?: string
}

export interface StatusWithSkills extends Status {
  skills?: Skill[]
}

// Content block types for chat messages
export interface ChatContentBlock {
  type: 'text' | 'thinking' | 'toolCall'
  text?: string
  thinking?: string
  toolCall?: {
    id: string
    name: string
    arguments: Record<string, unknown>
  }
}

// Agent info from gateway
export interface AgentInfo {
  gatewayId: string
  gatewayName: string
  agentId: string
  agentName: string
  sessionKey: string
}
