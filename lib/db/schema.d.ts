/**
 * Database Schema Type Definitions
 * Auto-generated type definitions for ClawAgentHub database tables
 */

// ============================================================================
// User Types
// ============================================================================

/**
 * User entity representing a system user
 */
export interface User {
  /** Unique user identifier (UUID) */
  id: string
  /** User's email address (unique) */
  email: string
  /** Bcrypt hashed password */
  password_hash: string
  /** Whether user has superuser privileges */
  is_superuser: boolean
  /** Whether user has changed their initial password */
  first_password_changed: boolean
  /** Timestamp when user was created */
  created_at: string
  /** Timestamp when user was last updated */
  updated_at: string
}

/**
 * User creation input (without generated fields)
 */
export interface UserInsert {
  id: string
  email: string
  password_hash: string
  is_superuser?: boolean
  first_password_changed?: boolean
  created_at?: string
  updated_at?: string
}

/**
 * User update input (partial fields)
 */
export interface UserUpdate {
  email?: string
  password_hash?: string
  is_superuser?: boolean
  first_password_changed?: boolean
  updated_at?: string
}

/**
 * Public user data (safe to expose to clients)
 */
export interface UserPublic {
  id: string
  email: string
  is_superuser: boolean
  first_password_changed: boolean
  created_at: string
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session entity for user authentication
 */
export interface Session {
  /** Unique session identifier (UUID) */
  id: string
  /** ID of the user this session belongs to */
  user_id: string
  /** Session token (used in cookies) */
  token: string
  /** Timestamp when session expires */
  expires_at: string
  /** Timestamp when session was created */
  created_at: string
  /** Client origin for WebSocket connections */
  origin: string | null
}

/**
 * Session creation input
 */
export interface SessionInsert {
  id: string
  user_id: string
  token: string
  expires_at: string
  created_at?: string
  origin?: string | null
}

/**
 * Session with user data (joined query result)
 */
export interface SessionWithUser extends Session {
  user: User
}

// ============================================================================
// Setup Token Types
// ============================================================================

/**
 * Setup token for initial superuser creation
 */
export interface SetupToken {
  /** Unique token identifier (UUID) */
  id: string
  /** The actual token string */
  token: string
  /** Whether token has been used */
  used: boolean
  /** Timestamp when token expires */
  expires_at: string
  /** Timestamp when token was created */
  created_at: string
}

/**
 * Setup token creation input
 */
export interface SetupTokenInsert {
  id: string
  token: string
  used?: boolean
  expires_at: string
  created_at?: string
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Migration tracking record
 */
export interface Migration {
  /** Auto-incrementing migration ID */
  id: number
  /** Migration name (e.g., "001_initial") */
  name: string
  /** Timestamp when migration was applied */
  applied_at: string
}

/**
 * Migration insert input
 */
export interface MigrationInsert {
  name: string
  applied_at?: string
}

// ============================================================================
// Database Query Result Types
// ============================================================================

/**
 * Generic count query result
 */
export interface CountResult {
  count: number
}

/**
 * Generic exists query result
 */
export interface ExistsResult {
  exists: number
}

/**
 * Table info from sqlite_master
 */
export interface TableInfo {
  name: string
  type: string
  sql: string
}

/**
 * Column info from PRAGMA table_info
 */
export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Login request body
 */
export interface LoginRequest {
  email: string
  password: string
}

/**
 * Login response body
 */
export interface LoginResponse {
  success: boolean
  user: UserPublic
}

/**
 * Setup request body
 */
export interface SetupRequest {
  email: string
  password: string
  confirmPassword: string
  token: string
}

/**
 * Setup response body
 */
export interface SetupResponse {
  success: boolean
  user: UserPublic
}

/**
 * Setup check response
 */
export interface SetupCheckResponse {
  setupRequired: boolean
}

/**
 * Generic error response
 */
export interface ErrorResponse {
  message: string
  error?: string
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P]
}

/**
 * Make all properties required
 */
export type Required<T> = {
  [P in keyof T]-?: T[P]
}

/**
 * Pick specific properties from a type
 */
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P]
}

/**
 * Omit specific properties from a type
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

// ============================================================================
// Database Connection Types
// ============================================================================

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /** Path to SQLite database file */
  path: string
  /** Enable WAL mode (recommended) */
  wal?: boolean
  /** Enable foreign keys */
  foreignKeys?: boolean
  /** Timeout for database operations (ms) */
  timeout?: number
}

/**
 * Migration file definition
 */
export interface MigrationFile {
  /** Migration filename */
  filename: string
  /** Migration name (without extension) */
  name: string
  /** SQL content */
  sql: string
}

// ============================================================================
// Re-export for convenience
// ============================================================================

export type {
  User,
  UserInsert,
  UserUpdate,
  UserPublic,
  Session,
  SessionInsert,
  SessionWithUser,
  SetupToken,
  SetupTokenInsert,
  Migration,
  MigrationInsert,
}
