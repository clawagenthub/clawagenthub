#!/usr/bin/env tsx
/**
 * Apply Migration 009: Remove Device Pairing System
 * 
 * This migration removes all device identity and pairing-related columns
 * and simplifies the gateway table to use only token-based authentication.
 * 
 * Usage:
 *   npm run script scripts/apply-migration-009.ts
 */

import { getDatabase } from '../lib/db/index.js'
import { readFileSync } from 'fs'
import { join } from 'path'

async function main() {
  console.log('🔄 Applying Migration 009: Remove Device Pairing System\n')
  
  try {
    const db = getDatabase()
    
    // Check if migration already applied
    const existing = db
      .prepare('SELECT * FROM migrations WHERE name = ?')
      .get('009_remove_device_pairing')
    
    if (existing) {
      console.log('✓ Migration 009_remove_device_pairing already applied')
      return
    }
    
    // Read migration file
    const migrationPath = join(process.cwd(), 'lib/db/migrations/009_remove_device_pairing.sql')
    const sql = readFileSync(migrationPath, 'utf-8')
    
    // Execute migration
    console.log('📝 Executing migration...')
    db.exec(sql)
    
    // Record migration
    db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(
      '009_remove_device_pairing',
      new Date().toISOString()
    )
    
    console.log('✅ Migration 009_remove_device_pairing applied successfully\n')
    
    // Show gateways that need token updates
    const gatewaysNeedingUpdate = db
      .prepare("SELECT id, name, auth_token FROM gateways WHERE auth_token = 'PLEASE_UPDATE_TOKEN'")
      .all() as Array<{ id: string; name: string; auth_token: string }>
    
    if (gatewaysNeedingUpdate.length > 0) {
      console.log('⚠️  The following gateways need their tokens updated:\n')
      gatewaysNeedingUpdate.forEach(gateway => {
        console.log(`   - ${gateway.name} (ID: ${gateway.id})`)
      })
      console.log('\n💡 Update tokens using:')
      console.log('   sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = \'your-token\' WHERE id = \'gateway-id\';"')
      console.log('\n   Or use the ClawAgentHub UI to update gateway tokens.')
    } else {
      console.log('✅ All gateways have valid tokens')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

main().catch(console.error)
