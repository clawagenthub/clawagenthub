export type RetentionClass = 'short' | 'medium' | 'long'

export enum logCategories {
  WAITING_TO_FLOW_SERVICE = '[WaitingToFlowService]',
  FLOW_AUTO_FINISH = '[FlowAutoFinish]',
  IDLE_TIMEOUT_SERVICE = '[IdleTimeoutService]',
  GATEWAY_SERVICE = '[GatewayService]',
  SYSTEM = '[System]',
  MIDDLEWARE = '[MIDDLEWARE]',
  DATABASE = '[Database]',
  SESSION = '[Session]',
  AUTH = '[Auth]',
  API = '[API]',
  API_CHAT = '[API_CHAT]',
  API_GATEWAY = '[API_GATEWAY]',
  API_TICKETS = '[API_TICKETS]',
  API_WORKSPACES = '[API_WORKSPACES]',
  API_STATUSES = '[API_STATUSES]',
  API_SKILLS = '[API_SKILLS]',
  API_USER = '[API_USER]',
  API_SETUP = '[API_SETUP]',
  GATEWAY_CLIENT = '[GatewayClient]',
  GATEWAY_INSTANCE = '[GatewayInstance]',
  GATEWAY_EVENTS = '[GatewayEvents]',
  GATEWAY_BRIDGE = '[GatewayBridge]',
  GATEWAY_MANAGER = '[GatewayManager]',
  SESSION_STATUS = '[SessionStatus]',
  SESSION_HEARTBEAT = '[SessionHeartbeat]',
  INSTANCE_MANAGER = '[InstanceManager]',
  WEBSOCKET = '[WebSocket]',
  WS_MANAGER = '[WSManager]',
  CHAT = '[Chat]',
  STREAMING = '[Streaming]',
  HOOK = '[Hook]',
  INITIALIZATION = '[Initialization]',
  MIGRATION = '[Migration]',
  SEEDER = '[Seeder]',
}

export interface LogOptions {
  category: logCategories
  retention?: RetentionClass
}

export interface LoggerApi {
  info(opts: LogOptions, message: string, ...args: unknown[]): void
  error(opts: LogOptions, message: string, ...args: unknown[]): void
  warn(opts: LogOptions, message: string, ...args: unknown[]): void
  debug(opts: LogOptions, message: string, ...args: unknown[]): void
  verbose(opts: LogOptions, message: string, ...args: unknown[]): void
  silly(opts: LogOptions, message: string, ...args: unknown[]): void
}

export function formatMessage(message: string, args: unknown[]): string {
  if (args.length === 0) return message
  let formatted = message
  for (const arg of args) {
    formatted = formatted.replace('%s', String(arg))
  }
  return formatted
}
