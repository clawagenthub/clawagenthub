# ClawAgentHub Implementation Roadmap

## Phase 1: Project Foundation (First Step - Login Page Only)

### Step 1: Project Initialization
```bash
# Create project directory
mkdir clawhub
cd clawhub

# Initialize Vinext project
npm create vinext@latest .

# Install core dependencies
npm install better-sqlite3 bcryptjs nanoid zod

# Install dev dependencies
npm install -D @types/better-sqlite3 @types/bcryptjs tailwindcss autoprefixer postcss eslint prettier prettier-plugin-tailwindcss
```

### Step 2: Configuration Files

#### [`vite.config.ts`]
```typescript
import { defineConfig } from 'vite'
import vinext from 'vinext'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
```

#### [`tailwind.config.ts`]
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
```

#### [`.eslintrc.json`]
```json
{
  "extends": ["next/core-web-vitals", "prettier"],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error", "info"] }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

#### [`.prettierrc`]
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Step 3: Database Layer

#### [`lib/db/migrations/001_initial.sql`]
```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_superuser BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Setup tokens table
CREATE TABLE IF NOT EXISTS setup_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  used BOOLEAN DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_setup_tokens_token ON setup_tokens(token);

-- Migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### [`lib/db/index.ts`]
Key functions:
- `getDatabase()` - Get database connection
- `runMigrations()` - Execute pending migrations
- `initializeDatabase()` - Setup database on first run

#### [`lib/db/schema.ts`]
TypeScript types for database tables:
- `User`
- `Session`
- `SetupToken`

### Step 4: Authentication Utilities

#### [`lib/auth/password.ts`]
```typescript
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

#### [`lib/auth/token.ts`]
```typescript
import { nanoid } from 'nanoid'

export function generateSetupToken(): string {
  return nanoid(64)
}

export function generateSessionToken(): string {
  return nanoid(32)
}
```

#### [`lib/auth/session.ts`]
Functions for:
- Creating sessions
- Validating sessions
- Deleting sessions
- Getting user from session

### Step 5: Setup System

#### [`lib/setup/index.ts`]
```typescript
export async function checkSetupRequired(): Promise<boolean> {
  // Check if any superuser exists
  const db = getDatabase()
  const result = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_superuser = 1').get()
  return result.count === 0
}

export async function createSetupToken(): Promise<string> {
  const token = generateSetupToken()
  const expiresAt = new Date(Date.now() + 3600000) // 1 hour
  
  const db = getDatabase()
  db.prepare(`
    INSERT INTO setup_tokens (id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(nanoid(), token, expiresAt.toISOString())
  
  return token
}

export async function validateSetupToken(token: string): Promise<boolean> {
  const db = getDatabase()
  const result = db.prepare(`
    SELECT * FROM setup_tokens 
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).get(token)
  
  return !!result
}
```

### Step 6: API Routes

#### [`app/api/setup/check/route.ts`]
```typescript
export async function GET() {
  const setupRequired = await checkSetupRequired()
  return Response.json({ setupRequired })
}
```

#### [`app/api/setup/create/route.ts`]
```typescript
export async function POST(request: Request) {
  const { token, email, password } = await request.json()
  
  // Validate token
  // Validate input
  // Create superuser
  // Mark token as used
  // Return success
}
```

#### [`app/api/auth/login/route.ts`]
```typescript
export async function POST(request: Request) {
  const { email, password } = await request.json()
  
  // Validate input
  // Find user
  // Verify password
  // Create session
  // Set cookie
  // Return success
}
```

#### [`app/api/auth/logout/route.ts`]
```typescript
export async function POST(request: Request) {
  // Get session from cookie
  // Delete session
  // Clear cookie
  // Return success
}
```

### Step 7: UI Components

#### [`components/ui/button.tsx`]
Reusable button with variants:
- Primary
- Secondary
- Danger
- Loading state

#### [`components/ui/input.tsx`]
Reusable input with:
- Label
- Error message
- Different types (text, email, password)

#### [`components/ui/card.tsx`]
Card container for forms

### Step 8: Pages

#### [`app/setup/page.tsx`]
```typescript
'use client'

export default function SetupPage() {
  // Get token from URL
  // Validate token on mount
  // Show setup form
  // Handle form submission
  // Redirect to login on success
}
```

#### [`app/login/page.tsx`]
```typescript
'use client'

export default function LoginPage() {
  // Show login form
  // Handle form submission
  // Redirect to dashboard on success
}
```

#### [`app/page.tsx`]
```typescript
export default function HomePage() {
  // Check if authenticated
  // Redirect to login if not
  // Show dashboard if authenticated
}
```

### Step 9: Middleware

#### [`middleware.ts`]
```typescript
export function middleware(request: NextRequest) {
  // Check authentication
  // Protect routes
  // Redirect to login if needed
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|setup).*)',
  ],
}
```

### Step 10: Startup Logic

#### [`app/layout.tsx`] or separate initialization
```typescript
// On server start:
// 1. Initialize database
// 2. Run migrations
// 3. Check if setup required
// 4. If setup required, generate token and log URL
```

## Implementation Order

### Priority 1: Core Infrastructure
1. ✅ Project initialization
2. ✅ Configuration files
3. ✅ Database schema
4. ✅ Migration system
5. ✅ Database connection layer

### Priority 2: Authentication Foundation
6. ✅ Password utilities
7. ✅ Token generation
8. ✅ Session management
9. ✅ Setup token system

### Priority 3: API Layer
10. ✅ Setup check endpoint
11. ✅ Setup create endpoint
12. ✅ Login endpoint
13. ✅ Logout endpoint

### Priority 4: UI Layer
14. ✅ Base UI components
15. ✅ Setup page
16. ✅ Login page
17. ✅ Layout and styling

### Priority 5: Integration
18. ✅ Middleware
19. ✅ Startup logic
20. ✅ Testing and refinement

## Key Technical Decisions

### Database Choice: SQLite
- **Pros**: Simple, file-based, no server needed, perfect for Cloudflare D1
- **Cons**: Not suitable for high-concurrency (but fine for auth)
- **Library**: better-sqlite3 (synchronous, faster)

### Password Hashing: bcryptjs
- **Pros**: Industry standard, well-tested, pure JavaScript
- **Alternative**: argon2 (more secure but requires native bindings)

### Session Storage: Database
- **Pros**: Persistent, can be queried, works with SQLite
- **Alternative**: Redis/KV store (better for scale)

### Token Generation: nanoid
- **Pros**: Secure, URL-safe, smaller than UUID
- **Size**: 64 chars for setup token, 32 for session

### Validation: Zod
- **Pros**: TypeScript-first, runtime validation, great DX
- **Usage**: Validate all API inputs

## Environment Setup

### Development
```env
DATABASE_PATH=./data/clawhub.db
SESSION_SECRET=dev-secret-change-in-production
SESSION_DURATION=86400000
SETUP_TOKEN_DURATION=3600000
NODE_ENV=development
```

### Production (Cloudflare Workers)
```env
# Use Cloudflare D1 for database
# Use Cloudflare KV for sessions (optional)
# Set secrets via Cloudflare dashboard
```

## Testing Checklist

### Manual Testing
- [ ] First run generates setup URL
- [ ] Setup URL works and creates superuser
- [ ] Setup URL expires after 1 hour
- [ ] Setup URL can only be used once
- [ ] Login works with correct credentials
- [ ] Login fails with incorrect credentials
- [ ] Session persists across page reloads
- [ ] Logout clears session
- [ ] Protected routes redirect to login
- [ ] Migrations run automatically

### Edge Cases
- [ ] Multiple setup attempts
- [ ] Expired setup token
- [ ] Invalid setup token
- [ ] SQL injection attempts
- [ ] XSS attempts
- [ ] CSRF protection
- [ ] Rate limiting

## Deployment Steps

### Local Development
```bash
npm run dev
# Visit setup URL from console
# Create superuser
# Login at /login
```

### Cloudflare Workers
```bash
# Build for production
npm run build

# Deploy to Cloudflare
vinext deploy

# Set environment variables in Cloudflare dashboard
# Run migrations on first deploy
```

## Success Metrics

✅ **Setup works**: User can create superuser on first run  
✅ **Login works**: User can authenticate with credentials  
✅ **Security**: Passwords hashed, sessions secure, tokens expire  
✅ **UX**: Clean UI, clear error messages, responsive design  
✅ **Code quality**: ESLint/Prettier passing, TypeScript strict mode  
✅ **Migrations**: Database schema versioned and reproducible

## Next Steps After Phase 1

Once login page is complete and tested:
1. Add dashboard page
2. Add user management
3. Add password reset
4. Add email verification
5. Add 2FA
6. Add audit logging
7. Add API key management

## Notes

- Keep it simple for Phase 1
- Focus on security from the start
- Make it easy to extend later
- Document everything
- Test thoroughly before moving to Phase 2
