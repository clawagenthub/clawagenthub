import Database from 'better-sqlite3'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = process.env.DATABASE_PATH || './data/clawhub.db'
  const dbDir = dirname(dbPath)

  // Ensure data directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  return db
}

export function runMigrations(): void {
  const db = getDatabase()

  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const migrationsDir = join(__dirname, 'migrations')
  const migrationFiles = [
    '001_initial.sql',
    '002_add_first_password_changed.sql',
    '003_add_workspaces.sql',
    '004_add_gateways.sql',
    '005_add_device_identity.sql',
    '006_update_device_keys.sql',
    '007_add_pairing_status.sql',
    '008_add_session_origin.sql',
    '009_remove_device_pairing.sql',
    '010_add_chat_tables.sql',
    '011_add_session_status.sql',
    '012_add_session_description.sql',
    '013_add_user_settings.sql',
    '014_add_statuses.sql',
    '015_add_default_statuses.sql',
    '016_add_status_priority.sql',
    '017_add_status_agent_id.sql',
    '018_add_status_flow_properties.sql',
    '019_add_tickets_table.sql',
    '020_add_ticket_flow_configs_table.sql',
    '021_add_ticket_comments_table.sql',
    '022_add_ticket_audit_logs_table.sql',
    '023_add_ticket_flow_history_table.sql',
    '024_add_workspace_ticket_sequences_table.sql',
    '025_add_ticket_creation_status.sql',
    '026_add_ticket_flowing_status.sql',
    '027_add_ticket_flow_mode.sql',
  ]

  for (const file of migrationFiles) {
    const migrationName = file.replace('.sql', '')

    // Check if migration already applied
    const existing = db
      .prepare('SELECT name FROM migrations WHERE name = ?')
      .get(migrationName)

    if (!existing) {
      console.info(`📦 Running migration: ${migrationName}`)
      const migrationPath = join(migrationsDir, file)
      const sql = readFileSync(migrationPath, 'utf-8')

      try {
        db.exec(sql)
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName)
        console.info(`✓ Migration ${migrationName} applied`)
      } catch (error: any) {
        // Handle idempotent-safe errors (column/table already exists)
        const errorMessage = error?.message || String(error)
        if (
          errorMessage.includes('duplicate column name') ||
          errorMessage.includes('table') && errorMessage.includes('already exists')
        ) {
          console.info(`ℹ️  Migration ${migrationName}: Object already exists, marking as applied`)
          db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName)
          console.info(`✓ Migration ${migrationName} marked as applied`)
        } else {
          // Re-throw unexpected errors
          throw error
        }
      }
    }
  }
}

export function initializeDatabase(): void {
  console.info('🚀 Initializing database...')
  getDatabase()
  runMigrations()
  console.info('✓ Database initialized')
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
