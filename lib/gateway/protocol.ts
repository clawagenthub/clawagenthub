/**
 * OpenClaw Gateway Protocol v3 Types
 * 
 * This file defines the WebSocket protocol types for communicating with
 * the OpenClaw Gateway. Based on the OpenClaw openclaw/openclaw repository.
 */

// ============================================================================
// FRAME TYPES
// ============================================================================

/** Request frame sent to gateway */
export interface RequestFrame {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

/** Response frame received from gateway */
export interface ResponseFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { message?: string; code?: number }
}

/** Event frame received from gateway */
export interface EventFrame {
  type: 'event'
  event: string
  seq?: number
  payload?: unknown
}

// ============================================================================
// CONNECTION PROTOCOL
// ============================================================================

/** Connect method parameters */
export interface ConnectParams {
  /** Auth token for authentication */
  token: string
  /** Nonce from challenge response */
  nonce?: string
  /** Origin header for WebSocket */
  origin?: string
}

/** Challenge event payload from gateway */
export interface ConnectChallengePayload {
  nonce?: string
}

// ============================================================================
// CHAT PROTOCOL
// ============================================================================

/** Chat send method parameters */
export interface ChatSendParams {
  /** Session key in format: agent:{agentId}:main */
  sessionKey: string
  /** Message content (simple string) */
  message: string
  /** Idempotency key for deduplication */
  idempotencyKey: string
  /** Optional thinking/instruction */
  thinking?: string
  /** Whether to deliver immediately */
  deliver?: boolean
  /** Timeout in milliseconds */
  timeoutMs?: number
}

/** Chat send response */
export interface ChatSendResponse {
  runId: string
  status: string
}

/** Chat history method parameters */
export interface ChatHistoryParams {
  /** Session key in format: agent:{agentId}:main */
  sessionKey: string
  /** Limit number of messages */
  limit?: number
}

/** Chat history response */
export interface ChatHistoryResponse {
  messages: ChatMessage[]
  sessionKey?: string
}

/** Chat abort method parameters */
export interface ChatAbortParams {
  /** Run ID to abort */
  runId: string
}

/** Message role */
export type MessageRole = 'user' | 'assistant' | 'system'

/** Chat message structure */
export interface ChatMessage {
  role: MessageRole
  content: string
  timestamp?: string
  metadata?: Record<string, unknown>
}

/** Chat event state */
export type ChatEventState = 'delta' | 'final' | 'error'

/** Chat event payload from gateway */
export interface ChatEventPayload {
  runId: string
  sessionKey: string
  seq: number
  state: ChatEventState
  message?: ChatMessage
  errorMessage?: string
}

// ============================================================================
// AGENT PROTOCOL
// ============================================================================

/** Agent list response */
export interface AgentListResponse {
  agents?: AgentInfo[]
}

/** Agent information */
export interface AgentInfo {
  id: string
  name?: string
  model?: string
  status?: string
  sessionKey?: string
  capabilities?: {
    imageRecognition?: boolean
  }
}

/** Agent typing event payload */
export interface AgentTypingPayload {
  agentId: string
  sessionKey: string
  isTyping: boolean
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/** Session resolve method parameters */
export interface SessionResolveParams {
  /** Session key to resolve */
  sessionKey: string
}

/** Session resolve response */
export interface SessionResolveResponse {
  sessionId?: string
  sessionKey?: string
}

/** Session patch method parameters */
export interface SessionPatchParams {
  /** Session key to patch */
  sessionKey: string
  /** Title for the session */
  title?: string
  /** Description for the session */
  description?: string
}

// ============================================================================
// HEALTH PROTOCOL
// ============================================================================

/** Health check response */
export interface HealthStatus {
  ok: boolean
  message?: string
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/** All possible gateway event types */
export type GatewayEventType =
  | 'connect.challenge'
  | 'chat'
  | 'agent'
  | 'presence'
  | 'tick'
  | 'health'

// ============================================================================
// INSTANCE PROTOCOL (Client <-> Instance)
// ============================================================================

/** Message types between client and session instance */
export type InstanceMessageType =
  | 'subscribe'       // Subscribe to a session instance
  | 'unsubscribe'     // Unsubscribe from a session instance
  | 'chat.send'       // Send a chat message through the instance
  | 'chat.abort'      // Abort a running chat
  | 'reconnect'       // Reconnect with sequence number
  | 'ping'            // Ping/keep-alive
  | 'pong'            // Pong response

/** Subscribe message from client */
export interface InstanceSubscribeMessage {
  type: 'subscribe'
  sessionId: string
  agentId: string
  sinceSeq?: number  // Resume from this sequence number
}

/** Unsubscribe message from client */
export interface InstanceUnsubscribeMessage {
  type: 'unsubscribe'
  sessionId: string
}

/** Chat send message from client */
export interface InstanceChatSendMessage {
  type: 'chat.send'
  sessionId: string
  content: string
  options?: {
    thinking?: string
    deliver?: boolean
  }
}

/** Chat abort message from client */
export interface InstanceChatAbortMessage {
  type: 'chat.abort'
  sessionId: string
  runId: string
}

/** Reconnect message from client */
export interface InstanceReconnectMessage {
  type: 'reconnect'
  sessionId: string
  sinceSeq?: number
}

/** Ping message */
export interface InstancePingMessage {
  type: 'ping'
  timestamp: number
}

/** Pong message */
export interface InstancePongMessage {
  type: 'pong'
  timestamp: number
}

/** Event messages from instance to client */
export type InstanceEventMessageType =
  | 'chat.delta'       // Streaming chat content delta
  | 'chat.final'       // Final chat message
  | 'chat.error'       // Chat error
  | 'agent.typing'     // Agent typing indicator
  | 'state.changed'    // Instance state changed
  | 'connected'        // Successfully connected to instance
  | 'error'            // Instance error
  | 'pong'             // Pong response

/** Chat delta event from instance */
export interface InstanceChatDeltaEvent {
  type: 'chat.delta'
  sessionId: string
  runId: string
  seq: number
  delta: string
}

/** Chat final event from instance */
export interface InstanceChatFinalEvent {
  type: 'chat.final'
  sessionId: string
  runId: string
  seq: number
  message: ChatMessage
}

/** Chat error event from instance */
export interface InstanceChatErrorEvent {
  type: 'chat.error'
  sessionId: string
  runId: string
  seq: number
  error: string
}

/** Agent typing event from instance */
export interface InstanceAgentTypingEvent {
  type: 'agent.typing'
  sessionId: string
  agentId: string
  isTyping: boolean
}

/** State changed event from instance */
export interface InstanceStateChangedEvent {
  type: 'state.changed'
  sessionId: string
  state: 'connecting' | 'connected' | 'disconnected' | 'error'
  error?: string
}

/** Connected event from instance */
export interface InstanceConnectedEvent {
  type: 'connected'
  sessionId: string
  currentSeq: number
}

/** Error event from instance */
export interface InstanceErrorEvent {
  type: 'error'
  sessionId: string
  error: string
}

/** Pong event from instance */
export interface InstancePongEvent {
  type: 'pong'
  sessionId: string
  timestamp: number
}

/** Union of all instance messages */
export type InstanceMessage =
  | InstanceSubscribeMessage
  | InstanceUnsubscribeMessage
  | InstanceChatSendMessage
  | InstanceChatAbortMessage
  | InstanceReconnectMessage
  | InstancePingMessage
  | InstancePongMessage

/** Union of all instance events */
export type InstanceEvent =
  | InstanceChatDeltaEvent
  | InstanceChatFinalEvent
  | InstanceChatErrorEvent
  | InstanceAgentTypingEvent
  | InstanceStateChangedEvent
  | InstanceConnectedEvent
  | InstanceErrorEvent
  | InstancePongEvent

// ============================================================================
// INSTANCE STATE
// ============================================================================

/** Session instance state */
export type InstanceState =
  | 'idle'        // Not connected, no clients
  | 'connecting'  // Connecting to gateway
  | 'connected'   // Connected to gateway
  | 'disconnected' // Disconnected, will reconnect
  | 'error'       // Error state
  | 'stopped'     // Stopped, will not reconnect

/** Instance status information */
export interface InstanceStatus {
  sessionId: string
  agentId: string
  sessionKey: string
  state: InstanceState
  gatewayId: string
  clientCount: number
  currentSeq: number
  connectedAt?: Date
  lastActivityAt: Date
  error?: string
}
