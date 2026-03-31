# TanStack Query Migration Plan - Fix Infinite Loop

## Executive Summary

Migrate ClawAgentHub from Jotai to TanStack Query (React Query) to solve the infinite loop issue and gain better server-state management capabilities with full Next.js SSR support.

## Why TanStack Query?

### Current Problem with Jotai
- **Infinite Loop**: [`useUser.ts:44`](../lib/store/hooks/useUser.ts:44) has `refreshUser` in `useEffect` dependencies causing continuous re-renders
- **Manual State Management**: Need to manually handle caching, refetching, and intervals
- **Not Designed for Server State**: Jotai is for client state, not async server data
- **Complex Patterns**: Requires custom hooks and atoms for simple data fetching

### TanStack Query Benefits
✅ **Built-in SSR/Hydration**: Native Next.js App Router support with `HydrationBoundary`  
✅ **Automatic Caching**: Smart caching with stale-while-revalidate  
✅ **No Infinite Loops**: Proper dependency management built-in  
✅ **Auto Refetching**: Window focus, network reconnect, polling - all handled  
✅ **Request Deduplication**: Multiple components requesting same data = 1 request  
✅ **Optimistic Updates**: Built-in mutation support  
✅ **DevTools**: Excellent debugging experience  
✅ **TypeScript First**: Full type safety  

## Architecture Overview

### Current Architecture (Jotai)
```
┌─────────────────────────────────────────────────────────┐
│                    App Layout                           │
│                  (JotaiProvider)                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Client Components                      │
│              (useUser, useGateways)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Jotai Atoms                           │
│         (userAtom, gatewaysAtom)                        │
│                                                         │
│  Problem: Manual useEffect with unstable dependencies   │
│  Result: Infinite loop calling /api/auth/me            │
└─────────────────────────────────────────────────────────┘
```

### New Architecture (TanStack Query)
```
┌─────────────────────────────────────────────────────────┐
│                    App Layout                           │
│              (QueryClientProvider)                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Server Components (RSC)                    │
│         Prefetch data with QueryClient                  │
│         Wrap with HydrationBoundary                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Client Components                      │
│              (useQuery, useMutation)                    │
│                                                         │
│  Solution: TanStack Query handles all refetch logic     │
│  Result: No infinite loops, smart caching               │
└─────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Setup TanStack Query

#### 1.1 Install Dependencies
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

#### 1.2 Create Query Client Provider
**File**: `lib/query/provider.tsx`
```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

// Create a client factory to avoid sharing state between users
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we set staleTime to avoid refetching immediately on client
        staleTime: 60 * 1000, // 60 seconds - matches current REFRESH_INTERVAL
        gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
        refetchOnWindowFocus: true, // Refetch when user returns to tab
        refetchOnReconnect: true, // Refetch when network reconnects
        retry: 1, // Retry failed requests once
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  // Server: always make a new query client
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  
  // Browser: make a new query client if we don't already have one
  // This is important for React 19 to avoid recreating on suspense
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  
  return browserQueryClient
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

#### 1.3 Update Root Layout
**File**: `app/layout.tsx`
```typescript
import '@/app/globals.css'
import { ThemeProvider } from '@/lib/contexts/theme-context'
import { QueryProvider } from '@/lib/query/provider'

export const metadata = {
  title: 'ClawAgentHub - Authentication Dashboard',
  description: 'Secure authentication system with PocketBase-style setup',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('clawhub-theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
```

### Phase 2: Migrate User Authentication

#### 2.1 Create Query Keys
**File**: `lib/query/keys.ts`
```typescript
// Centralized query keys for type safety and consistency
export const queryKeys = {
  user: {
    me: ['user', 'me'] as const,
  },
  gateways: {
    all: ['gateways'] as const,
    detail: (id: string) => ['gateways', id] as const,
  },
  workspaces: {
    all: ['workspaces'] as const,
    current: ['workspaces', 'current'] as const,
  },
} as const
```

#### 2.2 Create User Query Hook
**File**: `lib/query/hooks/useUser.ts`
```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../keys'

export interface UserInfo {
  id: string
  email: string
  is_superuser: boolean
  first_password_changed: boolean
}

interface UserResponse {
  user: UserInfo | null
}

async function fetchUser(): Promise<UserInfo | null> {
  const response = await fetch('/api/auth/me', {
    credentials: 'include',
  })
  
  if (!response.ok) {
    return null
  }
  
  const data: UserResponse = await response.json()
  return data.user
}

/**
 * Hook to access user data with automatic caching and refetching
 * 
 * TanStack Query automatically handles:
 * - Caching (60 seconds stale time)
 * - Background refetching on window focus
 * - Deduplication of simultaneous requests
 * - Loading and error states
 * 
 * No more infinite loops! 🎉
 */
export function useUser() {
  const query = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: fetchUser,
    // Optional: customize per-query settings
    staleTime: 60 * 1000, // Consider data fresh for 60 seconds
    refetchInterval: 60 * 1000, // Auto-refetch every 60 seconds (like current behavior)
  })

  return {
    user: query.data ?? null,
    isAuthenticated: query.data !== null,
    mustChangePassword: query.data?.is_superuser === true && 
                       query.data?.first_password_changed === false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch, // Manual refresh function
  }
}
```

#### 2.3 Create Login Mutation
**File**: `lib/query/hooks/useLogin.ts`
```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'

interface LoginCredentials {
  email: string
  password: string
}

interface LoginResponse {
  success: boolean
  message?: string
  user?: {
    id: string
    email: string
    is_superuser: boolean
    first_password_changed: boolean
  }
}

async function loginUser(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Login failed')
  }
  
  return response.json()
}

export function useLogin() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // Invalidate and refetch user data after successful login
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me })
      
      // Optionally set the user data immediately (optimistic update)
      if (data.user) {
        queryClient.setQueryData(queryKeys.user.me, data.user)
      }
    },
  })
}
```

#### 2.4 Create Logout Mutation
**File**: `lib/query/hooks/useLogout.ts`
```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'

async function logoutUser(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
  
  if (!response.ok) {
    throw new Error('Logout failed')
  }
}

export function useLogout() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear()
      
      // Or just invalidate user data
      // queryClient.setQueryData(queryKeys.user.me, null)
    },
  })
}
```

#### 2.5 Create Password Change Mutation
**File**: `lib/query/hooks/useChangePassword.ts`
```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'

interface ChangePasswordData {
  currentPassword: string
  newPassword: string
}

interface ChangePasswordResponse {
  success: boolean
  message: string
}

async function changePassword(data: ChangePasswordData): Promise<ChangePasswordResponse> {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Password change failed')
  }
  
  return response.json()
}

export function useChangePassword() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      // Refetch user data to get updated first_password_changed flag
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me })
    },
  })
}
```

### Phase 3: Migrate Gateways

#### 3.1 Create Gateways Query Hook
**File**: `lib/query/hooks/useGateways.ts`
```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'

interface Gateway {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'pairing'
  last_seen?: string
}

async function fetchGateways(): Promise<Gateway[]> {
  const response = await fetch('/api/gateways', {
    credentials: 'include',
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch gateways')
  }
  
  const data = await response.json()
  return data.gateways || []
}

export function useGateways() {
  const query = useQuery({
    queryKey: queryKeys.gateways.all,
    queryFn: fetchGateways,
    // Don't auto-refetch gateways as frequently as user data
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    gateways: query.data ?? [],
    gatewayCount: query.data?.length ?? 0,
    connectedGateways: query.data?.filter(g => g.status === 'connected') ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

// Add Gateway Mutation
interface AddGatewayData {
  name: string
  pairingCode: string
}

async function addGateway(data: AddGatewayData): Promise<Gateway> {
  const response = await fetch('/api/gateways/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to add gateway')
  }
  
  return response.json()
}

export function useAddGateway() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: addGateway,
    onSuccess: () => {
      // Refetch gateways list after adding
      queryClient.invalidateQueries({ queryKey: queryKeys.gateways.all })
    },
  })
}
```

### Phase 4: Update Components

#### 4.1 Update Dashboard Page
**File**: `app/dashboard/page.tsx`
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Modal } from '@/components/ui/modal'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { BoardColumn } from '@/components/board/board-column'
import { Button } from '@/components/ui/button'
import { useUser } from '@/lib/query/hooks/useUser'

interface Board {
  id: string
  title: string
  color: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, mustChangePassword, isLoading } = useUser()
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [boards, setBoards] = useState<Board[]>([
    { id: '1', title: 'To Do', color: '#ef4444' },
    { id: '2', title: 'In Progress', color: '#f59e0b' },
    { id: '3', title: 'Review', color: '#3b82f6' },
    { id: '4', title: 'Done', color: '#10b981' },
  ])
  const [draggedBoardId, setDraggedBoardId] = useState<string | null>(null)

  // Simple auth check - TanStack Query handles all the refetching logic
  useEffect(() => {
    if (!isLoading && user === null) {
      router.push('/login')
    }
    
    if (mustChangePassword) {
      setIsPasswordModalOpen(true)
    }
  }, [user, mustChangePassword, isLoading, router])

  const handlePasswordChangeSuccess = () => {
    // TanStack Query automatically refetches user data via mutation
    setIsPasswordModalOpen(false)
    alert('Password changed successfully!')
  }

  const handleModalClose = () => {
    if (!mustChangePassword) {
      setIsPasswordModalOpen(false)
    }
  }

  // ... rest of the component (drag/drop logic, etc.)

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: `rgb(var(--bg-primary))` }}
      >
        <div style={{ color: `rgb(var(--text-secondary))` }}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect via useEffect
  }

  return (
    <DashboardLayout user={user}>
      {/* ... rest of the JSX ... */}
    </DashboardLayout>
  )
}
```

#### 4.2 Update Login Form
**File**: `components/auth/login-form.tsx`
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogin } from '@/lib/query/hooks/useLogin'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const loginMutation = useLogin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const result = await loginMutation.mutateAsync({ email, password })
      
      if (result.success) {
        router.push('/dashboard')
      }
    } catch (error) {
      // Error is automatically captured by TanStack Query
      console.error('Login failed:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      
      {loginMutation.isError && (
        <div className="text-red-500 text-sm">
          {loginMutation.error?.message || 'Login failed'}
        </div>
      )}
      
      <Button 
        type="submit" 
        disabled={loginMutation.isPending}
        className="w-full"
      >
        {loginMutation.isPending ? 'Logging in...' : 'Login'}
      </Button>
    </form>
  )
}
```

### Phase 5: SSR/Hydration (Optional but Recommended)

#### 5.1 Create Server-Side Prefetch Utility
**File**: `lib/query/server.ts`
```typescript
import { QueryClient } from '@tanstack/react-query'

export function createServerQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Server-side queries should not refetch
        staleTime: Infinity,
      },
    },
  })
}
```

#### 5.2 Prefetch in Server Component (Example)
**File**: `app/dashboard/layout.tsx` (if you want SSR)
```typescript
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { createServerQueryClient } from '@/lib/query/server'
import { queryKeys } from '@/lib/query/keys'

async function fetchUserServer() {
  // Server-side fetch with cookies
  const response = await fetch('http://localhost:3000/api/auth/me', {
    credentials: 'include',
    cache: 'no-store',
  })
  
  if (!response.ok) return null
  
  const data = await response.json()
  return data.user
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = createServerQueryClient()
  
  // Prefetch user data on server
  await queryClient.prefetchQuery({
    queryKey: queryKeys.user.me,
    queryFn: fetchUserServer,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  )
}
```

### Phase 6: Cleanup

#### 6.1 Remove Jotai Files
- Delete `lib/store/atoms/userAtom.ts`
- Delete `lib/store/atoms/gatewaysAtom.ts`
- Delete `lib/store/hooks/useUser.ts`
- Delete `lib/store/hooks/useGateways.ts`
- Delete `lib/store/provider.tsx`
- Delete `lib/store/index.ts`

#### 6.2 Uninstall Jotai
```bash
npm uninstall jotai
```

#### 6.3 Update Imports
Update all components that import from `@/lib/store` to use `@/lib/query` instead.

## Migration Checklist

- [ ] Install `@tanstack/react-query` and `@tanstack/react-query-devtools`
- [ ] Create `lib/query/provider.tsx` with QueryClientProvider
- [ ] Create `lib/query/keys.ts` for centralized query keys
- [ ] Create `lib/query/hooks/useUser.ts` to replace Jotai userAtom
- [ ] Create `lib/query/hooks/useLogin.ts` for login mutation
- [ ] Create `lib/query/hooks/useLogout.ts` for logout mutation
- [ ] Create `lib/query/hooks/useChangePassword.ts` for password change
- [ ] Create `lib/query/hooks/useGateways.ts` to replace Jotai gatewaysAtom
- [ ] Update `app/layout.tsx` to use QueryProvider instead of JotaiProvider
- [ ] Update `app/dashboard/page.tsx` to use new hooks
- [ ] Update `app/profile/page.tsx` to use new hooks
- [ ] Update `app/gateways/page.tsx` to use new hooks
- [ ] Update `components/auth/login-form.tsx` to use useLogin mutation
- [ ] Update `components/auth/change-password-form.tsx` to use useChangePassword
- [ ] Update `components/layout/sidebar.tsx` if needed
- [ ] Test all authentication flows
- [ ] Test gateway management
- [ ] Verify no infinite loops in console
- [ ] Remove Jotai files and dependencies
- [ ] Update documentation

## Testing Strategy

### 1. Verify No Infinite Loops
```bash
# Start dev server
npm run dev

# Open browser console
# Navigate to /dashboard
# Verify /api/auth/me is called:
#   - Once on initial load
#   - Every 60 seconds (refetchInterval)
#   - On window focus (if configured)
#   - NOT continuously in a loop
```

### 2. Test Authentication Flows
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Forced password change for superuser
- [ ] Logout
- [ ] Session persistence across page refreshes
- [ ] Session expiry handling

### 3. Test Gateway Management
- [ ] List gateways
- [ ] Add new gateway
- [ ] Gateway status updates
- [ ] Multiple components using gateway data (deduplication test)

### 4. Test SSR/Hydration (if implemented)
- [ ] Disable JavaScript and verify initial render
- [ ] Check for hydration mismatches
- [ ] Verify data is prefetched on server

## Expected Outcomes

### Before (Jotai with Infinite Loop)
```
Console Output:
🔒 [MIDDLEWARE] Request: GET /api/auth/me
👤 [AUTH ME API] GET /api/auth/me
GET /api/auth/me 200 in 3ms
🔒 [MIDDLEWARE] Request: GET /api/auth/me
👤 [AUTH ME API] GET /api/auth/me
GET /api/auth/me 200 in 3ms
🔒 [MIDDLEWARE] Request: GET /api/auth/me
... (repeats infinitely)
```

### After (TanStack Query)
```
Console Output:
🔒 [MIDDLEWARE] Request: GET /api/auth/me
👤 [AUTH ME API] GET /api/auth/me
GET /api/auth/me 200 in 3ms

... (60 seconds pass) ...

🔒 [MIDDLEWARE] Request: GET /api/auth/me
👤 [AUTH ME API] GET /api/auth/me
GET /api/auth/me 200 in 3ms

... (clean, controlled refetching)
```

## Benefits Summary

| Feature | Jotai (Current) | TanStack Query (New) |
|---------|----------------|---------------------|
| Infinite Loop Issue | ❌ Yes | ✅ No |
| Auto Caching | ❌ Manual | ✅ Automatic |
| Request Deduplication | ❌ No | ✅ Yes |
| SSR Support | ⚠️ Limited | ✅ Full Support |
| DevTools | ❌ No | ✅ Yes |
| Loading States | ⚠️ Manual | ✅ Automatic |
| Error Handling | ⚠️ Manual | ✅ Automatic |
| Optimistic Updates | ⚠️ Complex | ✅ Built-in |
| Refetch on Focus | ❌ No | ✅ Yes |
| Polling/Intervals | ⚠️ Manual useEffect | ✅ Built-in |
| Mutations | ⚠️ Manual | ✅ Built-in |

## Timeline Estimate

- **Phase 1 (Setup)**: Install and configure TanStack Query
- **Phase 2 (User Auth)**: Migrate user authentication hooks
- **Phase 3 (Gateways)**: Migrate gateway management hooks
- **Phase 4 (Components)**: Update all components
- **Phase 5 (SSR)**: Optional SSR/hydration setup
- **Phase 6 (Cleanup)**: Remove Jotai, test thoroughly

## Conclusion

TanStack Query is the industry-standard solution for server-state management in React applications. It will:

1. **Fix the infinite loop** by properly managing refetch logic
2. **Improve performance** with smart caching and deduplication
3. **Enhance developer experience** with DevTools and better error handling
4. **Future-proof the codebase** with full Next.js SSR support
5. **Reduce code complexity** by removing manual state management

This migration is highly recommended and will solve the current issue while providing a more robust foundation for future development.
