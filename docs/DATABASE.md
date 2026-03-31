# Database Management Guide

This guide covers database initialization, migrations, seeding, and troubleshooting for ClawAgentHub.

## Quick Start

If you're seeing the error `SqliteError: no such table: users`, run:

```bash
npm run db:init
```

This will create all necessary database tables.

## Available Commands

### Initialize Database
Creates all tables and runs migrations:
```bash
npm run db:init
```

### Check Database Health
Verify database structure and integrity:
```bash
npm run db:check
```

### Seed Database
Populate database with test data:
```bash
# Seed everything (superuser + test users)
npm run db:seed

# Seed only superuser
npm run db:seed -- --superuser

# Seed only test users
npm run db:seed -- --test-users
```

**Default Credentials (Development Only):**
- Superuser: `admin@clawhub.local` / `admin123`
- Test User 1: `user1@test.local` / `password123`
- Test User 2: `user2@test.local` / `password123`
- Developer: `developer@test.local` / `dev123`

⚠️ **Change these passwords in production!**

### Reset Database
**WARNING:** This deletes all data!
```bash
npm run db:reset
```

## Database Schema

### Tables

#### `users`
Stores user accounts and authentication data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique user ID (UUID) |
| `email` | TEXT | User email (unique) |
| `password_hash` | TEXT | Bcrypt hashed password |
| `is_superuser` | BOOLEAN | Admin privileges flag |
| `created_at` | DATETIME | Account creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

#### `sessions`
Manages user authentication sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique session ID (UUID) |
| `user_id` | TEXT | Foreign key to users |
| `token` | TEXT | Session token (stored in cookies) |
| `expires_at` | DATETIME | Session expiration time |
| `created_at` | DATETIME | Session creation timestamp |

#### `setup_tokens`
One-time tokens for initial superuser creation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique token ID (UUID) |
| `token` | TEXT | The actual token string |
| `used` | BOOLEAN | Whether token has been used |
| `expires_at` | DATETIME | Token expiration time |
| `created_at` | DATETIME | Token creation timestamp |

#### `migrations`
Tracks applied database migrations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment ID |
| `name` | TEXT | Migration name (e.g., "001_initial") |
| `applied_at` | DATETIME | When migration was applied |

## TypeScript Types

All database types are defined in [`lib/db/schema.d.ts`](lib/db/schema.d.ts):

```typescript
import type { User, Session, SetupToken } from '@/lib/db/schema.d.js'
```

Available types:
- `User`, `UserInsert`, `UserUpdate`, `UserPublic`
- `Session`, `SessionInsert`, `SessionWithUser`
- `SetupToken`, `SetupTokenInsert`
- `Migration`, `MigrationInsert`
- `CountResult`, `ExistsResult`, `TableInfo`, `ColumnInfo`
- API types: `LoginRequest`, `LoginResponse`, `SetupRequest`, etc.

## Troubleshooting

### Error: "no such table: users"

**Cause:** Database tables haven't been created.

**Solution:**
```bash
npm run db:init
```

### Error: "Database file does not exist"

**Cause:** Database file hasn't been created yet.

**Solution:**
```bash
npm run db:init
```

### Error: "No superuser found"

**Cause:** No admin account exists.

**Solution 1 - Use seed script:**
```bash
npm run db:seed -- --superuser
```

**Solution 2 - Use setup URL:**
1. Start the dev server: `npm run dev`
2. Look for the setup URL in the console
3. Visit the URL to create your superuser account

### Database is corrupted

**Solution:**
```bash
npm run db:reset
npm run db:seed
```

### Check database status

```bash
npm run db:check
```

This will show:
- Database file location
- All tables and their structure
- Row counts for each table
- Applied migrations
- User counts

## Architecture

### Auto-Initialization

The database automatically initializes on startup via:

1. **Instrumentation Hook** ([`instrumentation.ts`](instrumentation.ts))
   - Runs when the app starts
   - Calls `ensureDatabase()` to verify tables exist
   - Creates setup token if no superuser exists

2. **Middleware** ([`lib/db/middleware.ts`](lib/db/middleware.ts))
   - Ensures database is ready before handling requests
   - Safe to call multiple times (idempotent)
   - Used in all API routes

3. **Manual Scripts** ([`scripts/`](scripts/))
   - Standalone initialization scripts
   - Can be run independently of the app
   - Useful for CI/CD and troubleshooting

### Migration System

Migrations are SQL files in [`lib/db/migrations/`](lib/db/migrations/):

- `001_initial.sql` - Creates all tables and indexes
- Future migrations can be added as `002_*.sql`, etc.

The migration system:
- Tracks applied migrations in the `migrations` table
- Only runs each migration once
- Runs migrations in order
- Is idempotent (safe to run multiple times)

### Database Location

Default: `./data/clawhub.db`

Override with environment variable:
```bash
DATABASE_PATH=/custom/path/database.db npm run dev
```

## Development Workflow

### Starting Fresh

```bash
# Reset everything
npm run db:reset

# Seed with test data
npm run db:seed

# Start dev server
npm run dev
```

### Adding a New Migration

1. Create `lib/db/migrations/002_your_migration.sql`
2. Add SQL statements to create/modify tables
3. Update `lib/db/index.ts` to include the new migration file
4. Run `npm run db:init` to apply

### Testing Database Changes

```bash
# Check current state
npm run db:check

# Make changes...

# Verify changes
npm run db:check
```

## Production Considerations

1. **Change default passwords** - Never use seed data in production
2. **Backup regularly** - SQLite database is a single file
3. **Use WAL mode** - Already enabled for better concurrency
4. **Monitor database size** - Consider archiving old sessions
5. **Secure database file** - Restrict file system permissions
6. **Use environment variables** - For database path and secrets

## Health Checks

The health check utility ([`lib/db/health.ts`](lib/db/health.ts)) provides:

```typescript
import { checkDatabaseHealth, isDatabaseReady, hasSuperuser } from '@/lib/db/health.js'

// Comprehensive health check
const health = checkDatabaseHealth()
console.log(health.healthy) // true/false
console.log(health.errors) // Array of error messages

// Quick checks
if (!isDatabaseReady()) {
  console.log('Database not initialized')
}

if (!hasSuperuser()) {
  console.log('No superuser exists')
}
```

## File Structure

```
lib/db/
├── index.ts           # Database connection and migration runner
├── schema.ts          # Basic schema interfaces
├── schema.d.ts        # Comprehensive TypeScript definitions
├── middleware.ts      # Auto-initialization middleware
├── health.ts          # Health check utilities
└── migrations/
    └── 001_initial.sql

scripts/
├── db-init.ts         # Initialize database
├── db-reset.ts        # Reset database
├── db-seed.ts         # Seed test data
└── db-check.ts        # Health check script
```

## Support

If you encounter issues:

1. Run `npm run db:check` to diagnose
2. Check the console output for error messages
3. Try `npm run db:reset` to start fresh
4. Review this documentation
5. Check the database file exists at `./data/clawhub.db`
