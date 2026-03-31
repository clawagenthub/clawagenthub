import { getDatabase } from '../lib/db/index.js'

async function applyMigration028() {
  console.log('Applying migration 028: Add workspace settings table...')
  
  const db = getDatabase()
  
  // Create workspace_settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_settings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      UNIQUE(workspace_id, setting_key)
    );
  `)
  
  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id ON workspace_settings(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_settings_key ON workspace_settings(workspace_id, setting_key);
  `)
  
  // Record migration
  const migrationId = Date.now()
  db.prepare(
    'INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)'
  ).run(migrationId, '028_add_workspace_settings', new Date().toISOString())
  
  console.log('✅ Migration 028 applied successfully!')
  console.log('Created tables:')
  console.log('  - workspace_settings')
  console.log('Created indexes:')
  console.log('  - idx_workspace_settings_workspace_id')
  console.log('  - idx_workspace_settings_key')
}

applyMigration028().catch(console.error)
