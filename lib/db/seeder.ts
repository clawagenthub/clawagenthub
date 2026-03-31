/**
 * Database Seeder Utilities
 * 
 * Functions for seeding default data into the database
 */

import { getDatabase } from './index.js'
import { generateUserId } from '../auth/token.js'

export interface DefaultStatus {
  name: string
  color: string
  description: string
  priority: number
}

export const DEFAULT_STATUSES: DefaultStatus[] = [
  {
    name: 'To Do',
    color: '#6B7280',
    description: 'Items that need to be done',
    priority: 1,
  },
  {
    name: 'In Progress',
    color: '#F59E0B',
    description: 'Items currently being worked on',
    priority: 2,
  },
  {
    name: 'Done',
    color: '#10B981',
    description: 'Completed items',
    priority: 3,
  },
]

/**
 * Seed default statuses for a workspace
 * @param workspaceId - The workspace ID to seed statuses for
 */
export function seedDefaultStatuses(workspaceId: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Check if workspace already has any statuses
  const existingStatuses = db
    .prepare('SELECT COUNT(*) as count FROM statuses WHERE workspace_id = ?')
    .get(workspaceId) as { count: number }

  if (existingStatuses.count > 0) {
    // Workspace already has statuses, don't seed defaults
    return
  }

  // Insert default statuses
  const insertStmt = db.prepare(
    `INSERT INTO statuses (id, name, color, description, workspace_id, priority, agent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  for (const status of DEFAULT_STATUSES) {
    const statusId = generateUserId()
    insertStmt.run(
      statusId,
      status.name,
      status.color,
      status.description,
      workspaceId,
      status.priority,
      null, // agent_id is null for default statuses (not assigned to any agent)
      now,
      now
    )
  }
}

/**
 * Seed default statuses for all existing workspaces that don't have any
 */
export function seedDefaultStatusesForAllWorkspaces(): void {
  const db = getDatabase()

  // Get all workspaces
  const workspaces = db
    .prepare('SELECT id FROM workspaces')
    .all() as Array<{ id: string }>

  for (const workspace of workspaces) {
    seedDefaultStatuses(workspace.id)
  }
}
