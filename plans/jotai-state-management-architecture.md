# Jotai State Management Architecture Plan

## Overview

This plan outlines the implementation of Jotai state management to replace the current problematic useEffect patterns that cause infinite loops. The new architecture will centralize state management and implement auto-refresh patterns for user and gateway data.

## Why Jotai?

- **Atomic State Management**: Bottom-up approach with minimal boilerplate
- **Next.js App Router Compatible**: Works seamlessly with Server/Client Components
- **Async Support**: Built-in support for async atoms and data fetching
- **Lightweight**: Only ~3KB, much smaller than Redux or Zustand
- **TypeScript First**: Excellent TypeScript support out of the box
- **No Provider Hell**: Single provider at the root level

## Architecture Design

### State Structure

```
lib/store/
├── atoms/
│   ├── userAtom.ts          # User authentication state
│   ├── gatewaysAtom.ts      # Gateways list state
│   └── index.ts             # Export all atoms
├── hooks/
│   ├── useUser.ts           # Hook for user data with auto-refresh
│   ├── useGateways.ts       # Hook for gateways data
│   └── index.ts             # Export all hooks
└── provider.tsx             # Jotai Provider component
```

## Implementation Steps

### Step 1: Install Jotai

```bash
npm install jotai
```

### Step 2: Create Jotai Provider

**File: `lib/store/provider.tsx`**

```typescript
'use client'

import { Provider } from 'jotai'
import { ReactNode } from 'react'

interface JotaiProviderProps {
  children: ReactNode
}

export function JotaiProvider({ children }: JotaiProviderProps) {
  return <Provider>{children}</Provider>
}
```

### Step 3: Wrap App with Provider

**File: `app/layout.tsx`** (modify existing)

```typescript
import { JotaiProvider } from '@/lib/store/provider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <JotaiProvider>
          {children}
        </JotaiProvider>
      </body>
    </html>
  )
}
```

### Step 4: Create User Atom with Auto-Refresh

**File: `lib/store/atoms/userAtom.ts`**

```typescript
import { atom } from 'jotai'
import { atomWithRefresh } from 'jotai/utils'

export interface UserInfo {
  id: string
  email: string
  is_superuser: boolean
  first_password_changed: boolean
}

// Base atom that fetches user data
// This atom will be refreshed automatically every minute
export const userAtom = atomWithRefresh(async (get) => {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.user as UserInfo | null
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
})

// Atom to track if user is authenticated
export const isAuthenticatedAtom = atom((get) => {
  const user = get(userAtom)
  return user !== null
})

// Atom to track if password change is required
export const mustChangePasswordAtom = atom((get) => {
  const user = get(userAtom)
  return user?.is_superuser && !user?.first_password_changed
})
```

### Step 5: Create User Hook with Auto-Refresh

**File: `lib/store/hooks/useUser.ts`**

```typescript
'use client'

import { useAtom, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { userAtom, isAuthenticatedAtom, mustChangePasswordAtom } from '../atoms/userAtom'

const REFRESH_INTERVAL = 60000 // 60 seconds (1 minute)

export function useUser() {
  const [user, refreshUser] = useAtom(userAtom)
  const [isAuthenticated] = useAtom(isAuthenticatedAtom)
  const [mustChangePassword] = useAtom(mustChangePasswordAtom)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Set up auto-refresh interval
    // This will refresh user data every minute to keep session fresh
    intervalRef.current = setInterval(() => {
      console.log('[useUser] Auto-refreshing user data...')
      refreshUser()
    }, REFRESH_INTERVAL)

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refreshUser])

  return {
    user,
    isAuthenticated,
    mustChangePassword,
    refreshUser, // Manual refresh function
  }
}

// Hook for components that only need to trigger refresh
export function useRefreshUser() {
  const refreshUser = useSetAtom(userAtom)
  return refreshUser
}
```

### Step 6: Create Gateways Atom

**File: `lib/store/atoms/gatewaysAtom.ts`**

```typescript
import { atom } from 'jotai'
import { atomWithRefresh } from 'jotai/utils'
import type { Gateway } from '@/lib/db/schema'

// Base atom that fetches gateways data
// This can be refreshed on-demand (e.g., after adding/deleting a gateway)
export const gatewaysAtom = atomWithRefresh(async (get) => {
  try {
    const response = await fetch('/api/gateways')
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    return (data.gateways || []) as Gateway[]
  } catch (error) {
    console.error('Error fetching gateways:', error)
    return []
  }
})

// Derived atom for gateway count
export const gatewayCountAtom = atom((get) => {
  const gateways = get(gatewaysAtom)
  return gateways.length
})

// Derived atom for connected gateways
export const connectedGatewaysAtom = atom((get) => {
  const gateways = get(gatewaysAtom)
  return gateways.filter((g) => g.status === 'connected')
})

// Loading state atom
export const gatewaysLoadingAtom = atom(false)
```

### Step 7: Create Gateways Hook

**File: `lib/store/hooks/useGateways.ts`**

```typescript
'use client'

import { useAtom, useSetAtom } from 'jotai'
import { 
  gatewaysAtom, 
  gatewayCountAtom, 
  connectedGatewaysAtom,
  gatewaysLoadingAtom 
} from '../atoms/gatewaysAtom'

export function useGateways() {
  const [gateways, refreshGateways] = useAtom(gatewaysAtom)
  const [gatewayCount] = useAtom(gatewayCountAtom)
  const [connectedGateways] = useAtom(connectedGatewaysAtom)
  const [loading, setLoading] = useAtom(gatewaysLoadingAtom)

  // Wrapper to refresh with loading state
  const refresh = async () => {
    setLoading(true)
    try {
      await refreshGateways()
    } finally {
      setLoading(false)
    }
  }

  return {
    gateways,
    gatewayCount,
    connectedGateways,
    loading,
    refresh,
  }
}

// Hook for components that only need to trigger refresh
export function useRefreshGateways() {
  const refreshGateways = useSetAtom(gatewaysAtom)
  return refreshGateways
}
```

### Step 8: Create Index Exports

**File: `lib/store/atoms/index.ts`**

```typescript
export * from './userAtom'
export * from './gatewaysAtom'
```

**File: `lib/store/hooks/index.ts`**

```typescript
export * from './useUser'
export * from './useGateways'
```

**File: `lib/store/index.ts`**

```typescript
export * from './atoms'
export * from './hooks'
export { JotaiProvider } from './provider'
```

## Usage in Components

### Dashboard Page

**File: `app/dashboard/page.tsx`** (refactored)

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/store/hooks'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
// ... other imports

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, mustChangePassword } = useUser()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  
  // Simple auth check - runs once on mount
  // No need for complex useEffect with dependencies
  useEffect(() => {
    if (!isAuthenticated && user === null) {
      router.push('/login')
    }
    
    if (mustChangePassword) {
      setIsPasswordModalOpen(true)
    }
  }, [isAuthenticated, user, mustChangePassword, router])

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <DashboardLayout user={user}>
      {/* Dashboard content */}
    </DashboardLayout>
  )
}
```

### Gateways Page

**File: `app/gateways/page.tsx`** (refactored)

```typescript
'use client'

import { useUser, useGateways } from '@/lib/store/hooks'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
// ... other imports

export default function GatewaysPage() {
  const { user } = useUser()
  const { gateways, loading, refresh } = useGateways()
  const [showAddModal, setShowAddModal] = useState(false)

  // No complex useEffect needed!
  // Data is automatically fetched when component mounts
  // and can be refreshed on-demand

  const handleAddSuccess = () => {
    refresh() // Refresh gateways after adding
  }

  const handleDelete = async (gatewayId: string) => {
    // Delete logic...
    await refresh() // Refresh after delete
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <DashboardLayout user={user}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1>Gateways ({gateways.length})</h1>
          <Button onClick={() => setShowAddModal(true)}>
            Add Gateway
          </Button>
        </div>

        {loading ? (
          <div>Loading gateways...</div>
        ) : (
          <div className="space-y-4">
            {gateways.map((gateway) => (
              <GatewayCard
                key={gateway.id}
                gateway={gateway}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
```

### Profile Page

**File: `app/profile/page.tsx`** (refactored)

```typescript
'use client'

import { useUser } from '@/lib/store/hooks'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
// ... other imports

export default function ProfilePage() {
  const { user, refreshUser } = useUser()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  const handlePasswordChangeSuccess = async () => {
    await refreshUser() // Refresh user data after password change
    setIsPasswordModalOpen(false)
    alert('Password changed successfully!')
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <DashboardLayout user={user}>
      {/* Profile content */}
    </DashboardLayout>
  )
}
```

### Login Form

**File: `components/auth/login-form.tsx`** (modify)

```typescript
'use client'

import { useRefreshUser } from '@/lib/store/hooks'
// ... other imports

export function LoginForm() {
  const refreshUser = useRefreshUser()
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // ... login logic
    
    if (response.ok) {
      // Refresh user data after successful login
      await refreshUser()
      router.push('/dashboard')
    }
  }

  // ... rest of component
}
```

## Benefits of This Architecture

### 1. **No More Infinite Loops**
- State is managed centrally in atoms
- No dependency array issues
- No state updates triggering re-fetches

### 2. **Automatic User Refresh**
- User data refreshes every 60 seconds automatically
- Keeps session fresh
- No manual polling needed in components

### 3. **On-Demand Gateway Refresh**
- Gateways refresh only when needed (add/delete/manual)
- No unnecessary API calls
- Better performance

### 4. **Cleaner Components**
- No complex useEffect logic
- No state management boilerplate
- Components focus on UI

### 5. **Type Safety**
- Full TypeScript support
- Type-safe atoms and hooks
- Better developer experience

### 6. **Centralized State**
- Single source of truth
- Easy to debug
- Consistent data across app

### 7. **Better Performance**
- Minimal re-renders
- Optimized atom dependencies
- Smaller bundle size

## Auto-Refresh Patterns

### User Data (Every Minute)

```typescript
// In useUser hook
useEffect(() => {
  const interval = setInterval(() => {
    refreshUser() // Refresh every 60 seconds
  }, 60000)
  
  return () => clearInterval(interval)
}, [refreshUser])
```

**Why every minute?**
- Keeps session alive
- Detects password changes
- Updates user permissions
- Minimal server load

### Gateway Data (On-Demand)

```typescript
// Manual refresh after operations
const handleAddGateway = async () => {
  await addGatewayAPI()
  await refresh() // Refresh list
}

const handleDeleteGateway = async (id) => {
  await deleteGatewayAPI(id)
  await refresh() // Refresh list
}
```

**Why on-demand?**
- Gateways don't change frequently
- User-initiated changes
- Reduces unnecessary API calls
- Better UX (immediate feedback)

## Migration Strategy

### Phase 1: Setup (Files to Create)
1. ✅ Install Jotai: `npm install jotai`
2. ✅ Create `lib/store/provider.tsx`
3. ✅ Create `lib/store/atoms/userAtom.ts`
4. ✅ Create `lib/store/atoms/gatewaysAtom.ts`
5. ✅ Create `lib/store/hooks/useUser.ts`
6. ✅ Create `lib/store/hooks/useGateways.ts`
7. ✅ Create index exports

### Phase 2: Integration (Files to Modify)
1. ✅ Modify `app/layout.tsx` - Add JotaiProvider
2. ✅ Refactor `app/dashboard/page.tsx` - Use useUser hook
3. ✅ Refactor `app/gateways/page.tsx` - Use useUser and useGateways hooks
4. ✅ Refactor `app/profile/page.tsx` - Use useUser hook
5. ✅ Modify `components/auth/login-form.tsx` - Refresh user on login
6. ✅ Modify `components/layout/sidebar.tsx` - Use useUser hook (optional)

### Phase 3: Cleanup (Files to Remove/Simplify)
1. ✅ Remove `initialized` state from gateways page
2. ✅ Remove complex useEffect patterns
3. ✅ Remove duplicate fetch logic
4. ✅ Simplify auth checks

### Phase 4: Testing
1. ✅ Test login flow
2. ✅ Test user auto-refresh (wait 1 minute)
3. ✅ Test gateway CRUD operations
4. ✅ Test password change flow
5. ✅ Test navigation between pages
6. ✅ Verify no infinite loops in console

## Advanced Features (Optional)

### 1. Persist User to LocalStorage

```typescript
import { atomWithStorage } from 'jotai/utils'

export const userAtom = atomWithStorage<UserInfo | null>(
  'clawhub-user',
  null,
  undefined,
  { getOnInit: true }
)
```

### 2. Add Loading States

```typescript
import { loadable } from 'jotai/utils'

export const userLoadableAtom = loadable(userAtom)

// In component
const userLoadable = useAtomValue(userLoadableAtom)

if (userLoadable.state === 'loading') return <Spinner />
if (userLoadable.state === 'hasError') return <Error />
return <div>{userLoadable.data.email}</div>
```

### 3. Add Optimistic Updates

```typescript
export const addGatewayAtom = atom(
  null,
  async (get, set, newGateway: Gateway) => {
    // Optimistically add to list
    const current = get(gatewaysAtom)
    set(gatewaysAtom, [...current, newGateway])
    
    try {
      await fetch('/api/gateways/add', {
        method: 'POST',
        body: JSON.stringify(newGateway)
      })
    } catch (error) {
      // Rollback on error
      set(gatewaysAtom, current)
      throw error
    }
  }
)
```

### 4. Add React Query Integration

```bash
npm install @tanstack/react-query jotai-tanstack-query
```

```typescript
import { atomWithQuery } from 'jotai-tanstack-query'

export const userAtom = atomWithQuery(() => ({
  queryKey: ['user'],
  queryFn: async () => {
    const res = await fetch('/api/auth/me')
    return res.json()
  },
  refetchInterval: 60000, // Auto-refresh every minute
}))
```

## File Structure Summary

```
githubprojects/clawhub/
├── app/
│   ├── layout.tsx                    # ✏️ MODIFY - Add JotaiProvider
│   ├── dashboard/page.tsx            # ✏️ REFACTOR - Use useUser
│   ├── gateways/page.tsx             # ✏️ REFACTOR - Use useUser & useGateways
│   └── profile/page.tsx              # ✏️ REFACTOR - Use useUser
├── components/
│   ├── auth/
│   │   └── login-form.tsx            # ✏️ MODIFY - Refresh user on login
│   └── layout/
│       └── sidebar.tsx               # ✏️ OPTIONAL - Use useUser
└── lib/
    └── store/                        # 🆕 NEW DIRECTORY
        ├── atoms/                    # 🆕 NEW
        │   ├── userAtom.ts           # 🆕 NEW
        │   ├── gatewaysAtom.ts       # 🆕 NEW
        │   └── index.ts              # 🆕 NEW
        ├── hooks/                    # 🆕 NEW
        │   ├── useUser.ts            # 🆕 NEW
        │   ├── useGateways.ts        # 🆕 NEW
        │   └── index.ts              # 🆕 NEW
        ├── provider.tsx              # 🆕 NEW
        └── index.ts                  # 🆕 NEW
```

## Testing Checklist

After implementation, verify:

- [ ] No infinite loops in console
- [ ] User data loads on login
- [ ] User data refreshes every 60 seconds
- [ ] Gateways load on page visit
- [ ] Gateways refresh after add/delete
- [ ] Password change updates user data
- [ ] Navigation between pages works
- [ ] Logout clears user data
- [ ] Session expiry redirects to login
- [ ] TypeScript types are correct
- [ ] No console errors
- [ ] Performance is improved

## Resources

- [Jotai Official Docs](https://jotai.org/)
- [Jotai Next.js Guide](https://jotai.org/docs/guides/nextjs)
- [Jotai Async Guide](https://jotai.org/docs/guides/async)
- [atomWithRefresh Recipe](https://jotai.org/docs/recipes/atom-with-refresh)
- [Jotai TypeScript Guide](https://jotai.org/docs/guides/typescript)

## Conclusion

This architecture solves the infinite loop problem by:
1. Centralizing state management
2. Eliminating problematic useEffect patterns
3. Implementing controlled auto-refresh
4. Providing clean, reusable hooks
5. Improving performance and maintainability

The implementation is straightforward, type-safe, and follows React best practices.
