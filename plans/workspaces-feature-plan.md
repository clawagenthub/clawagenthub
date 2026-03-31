# Workspaces Feature - Architecture Plan

## Overview

Add a multi-workspace system to ClawAgentHub where users can create and manage workspaces. Users own workspaces and can invite others to join (hybrid model). The UI includes a persistent left sidebar with a workspace dropdown selector at the top.

## Database Schema

### New Tables

#### `workspaces` Table
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
```

#### `workspace_members` Table
```sql
CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
```

### Schema Updates

#### `sessions` Table Enhancement
Add `current_workspace_id` to track active workspace per session:
```sql
ALTER TABLE sessions ADD COLUMN current_workspace_id TEXT;
```

## TypeScript Types

### [`lib/db/schema.ts`](lib/db/schema.ts)
```typescript
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

export interface WorkspaceWithRole extends Workspace {
  role: 'owner' | 'admin' | 'member'
  member_count?: number
}
```

## Database Migration

### File: [`lib/db/migrations/003_add_workspaces.sql`](lib/db/migrations/003_add_workspaces.sql)

Create new migration file with workspace tables and session enhancement.

### Update: [`lib/db/index.ts`](lib/db/index.ts)

Add `'003_add_workspaces.sql'` to the migration files array.

## Database Seeding

### Update: [`scripts/db-seed.ts`](scripts/db-seed.ts)

When creating the admin superuser, also:
1. Create "Admin Workspace" 
2. Add superuser as owner in `workspace_members` table
3. Set as default workspace

```typescript
// After creating admin user
const workspaceId = generateId()
db.prepare(
  `INSERT INTO workspaces (id, name, owner_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?)`
).run(workspaceId, 'Admin Workspace', userId, now, now)

const memberId = generateId()
db.prepare(
  `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
   VALUES (?, ?, ?, 'owner', ?)`
).run(memberId, workspaceId, userId, now)
```

## API Routes

### GET [`/api/workspaces`](app/api/workspaces/route.ts)
- Returns list of workspaces user has access to
- Includes role and member count
- Response: `{ workspaces: WorkspaceWithRole[] }`

### POST [`/api/workspaces/create`](app/api/workspaces/create/route.ts)
- Creates new workspace
- Automatically adds creator as owner
- Request: `{ name: string }`
- Response: `{ workspace: Workspace, success: boolean }`

### POST [`/api/workspaces/switch`](app/api/workspaces/switch/route.ts)
- Switches current workspace in session
- Request: `{ workspaceId: string }`
- Response: `{ success: boolean, workspace: Workspace }`

### GET [`/api/workspaces/current`](app/api/workspaces/current/route.ts)
- Returns current active workspace from session
- Response: `{ workspace: WorkspaceWithRole | null }`

## UI Components

### 1. Dropdown Component

**File**: [`components/ui/dropdown.tsx`](components/ui/dropdown.tsx)

Reusable dropdown component with:
- Trigger button
- Dropdown menu with items
- Support for icons and dividers
- Click outside to close
- Keyboard navigation

```typescript
interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

interface DropdownItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  divider?: boolean
}
```

### 2. WorkspaceSelector Component

**File**: [`components/workspace/workspace-selector.tsx`](components/workspace/workspace-selector.tsx)

Workspace dropdown with:
- Current workspace display
- List of available workspaces
- "Create New Workspace" option at bottom
- Switch workspace functionality
- Modal for creating new workspace

### 3. Sidebar Component

**File**: [`components/layout/sidebar.tsx`](components/layout/sidebar.tsx)

Persistent left sidebar with:
- WorkspaceSelector at top
- Navigation menu items (Dashboard, Settings, etc.)
- User profile section at bottom
- Logout button

Layout structure:
```
┌─────────────────────┐
│ [Workspace ▼]       │ ← WorkspaceSelector
├─────────────────────┤
│ 📊 Dashboard        │
│ ⚙️  Settings        │
│                     │
│                     │
├─────────────────────┤
│ 👤 user@email.com   │ ← User section
│ 🚪 Logout           │
└─────────────────────┘
```

### 4. DashboardLayout Component

**File**: [`components/layout/dashboard-layout.tsx`](components/layout/dashboard-layout.tsx)

Wrapper component for dashboard pages:
```typescript
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-50">
        {children}
      </main>
    </div>
  )
}
```

## State Management

### Workspace Context

**File**: [`lib/context/workspace-context.tsx`](lib/context/workspace-context.tsx)

React Context for workspace state:
```typescript
interface WorkspaceContextType {
  currentWorkspace: WorkspaceWithRole | null
  workspaces: WorkspaceWithRole[]
  switchWorkspace: (workspaceId: string) => Promise<void>
  createWorkspace: (name: string) => Promise<Workspace>
  refreshWorkspaces: () => Promise<void>
  loading: boolean
}
```

## User Flow

### Initial Login Flow
1. User logs in
2. System fetches user's workspaces
3. If user has workspaces, set first one as current
4. If no workspaces, prompt to create one
5. Store current workspace in session

### Workspace Switching Flow
1. User clicks workspace dropdown
2. Selects different workspace
3. API call to `/api/workspaces/switch`
4. Update session with new workspace ID
5. Refresh page content with new workspace context

### Create Workspace Flow
1. User clicks "Create New Workspace" in dropdown
2. Modal opens with name input
3. Submit creates workspace via API
4. User automatically becomes owner
5. New workspace becomes current workspace
6. Dropdown updates with new workspace

## File Structure

```
githubprojects/clawhub/
├── lib/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 003_add_workspaces.sql (NEW)
│   │   ├── schema.ts (UPDATE)
│   │   └── schema.d.ts (UPDATE)
│   └── context/
│       └── workspace-context.tsx (NEW)
├── components/
│   ├── ui/
│   │   └── dropdown.tsx (NEW)
│   ├── workspace/
│   │   └── workspace-selector.tsx (NEW)
│   └── layout/
│       ├── sidebar.tsx (NEW)
│       └── dashboard-layout.tsx (NEW)
├── app/
│   ├── api/
│   │   └── workspaces/
│   │       ├── route.ts (NEW - GET list)
│   │       ├── create/
│   │       │   └── route.ts (NEW)
│   │       ├── switch/
│   │       │   └── route.ts (NEW)
│   │       └── current/
│   │           └── route.ts (NEW)
│   └── dashboard/
│       └── page.tsx (UPDATE - use DashboardLayout)
└── scripts/
    └── db-seed.ts (UPDATE - create Admin Workspace)
```

## Implementation Phases

### Phase 1: Database Layer
1. Create migration file `003_add_workspaces.sql`
2. Update schema TypeScript types
3. Update `lib/db/index.ts` to include new migration
4. Run migration to create tables

### Phase 2: Seeding
1. Update `db-seed.ts` to create Admin Workspace
2. Test seeding creates workspace and membership correctly

### Phase 3: API Layer
1. Create workspace API routes
2. Implement workspace listing
3. Implement workspace creation
4. Implement workspace switching
5. Test all API endpoints

### Phase 4: UI Components
1. Create Dropdown component
2. Create WorkspaceSelector component
3. Create Sidebar component
4. Create DashboardLayout wrapper
5. Test components in isolation

### Phase 5: Integration
1. Add WorkspaceContext provider
2. Update dashboard page to use new layout
3. Wire up workspace switching
4. Test complete user flow

### Phase 6: Testing & Polish
1. Test workspace creation
2. Test workspace switching
3. Test persistence across sessions
4. Add loading states
5. Add error handling
6. Polish UI/UX

## Security Considerations

1. **Authorization**: Verify user has access to workspace before operations
2. **Ownership**: Only owners can delete workspaces
3. **Session Security**: Validate workspace_id in session belongs to user
4. **Input Validation**: Validate workspace names (length, characters)
5. **SQL Injection**: Use parameterized queries (already in place)

## Future Enhancements

- Workspace member invitation system
- Role-based permissions (admin, member)
- Workspace settings page
- Workspace deletion
- Transfer ownership
- Workspace activity logs
- Workspace avatars/colors
- Search workspaces

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Seed creates Admin Workspace
- [ ] User can view their workspaces
- [ ] User can create new workspace
- [ ] User can switch between workspaces
- [ ] Current workspace persists across page refreshes
- [ ] Sidebar displays correctly
- [ ] Dropdown works with keyboard navigation
- [ ] Multiple users can belong to same workspace
- [ ] Workspace owner is tracked correctly
- [ ] Session tracks current workspace
