# Login Page Loading Issue - Root Cause Analysis & Fix Plan

## Problem Statement

The login page at `http://localhost:3001/login` shows an infinite loading spinner and never renders the login form.

## Root Cause Analysis

### Error from Browser Console

```
Uncaught Error: An unknown Component is an async Client Component. 
Only Server Components can be async at the moment. 
This error is often caused by accidentally adding 'use client' to a module 
that was originally written for the server.

at useRefreshUser (useUser.ts:59:27)
at LoginPage (page.tsx:10:23)
```

### The Issue

The application was recently migrated from **Jotai** state management to **TanStack Query** (see [`TANSTACK_QUERY_MIGRATION_COMPLETE.md`](../docs/TANSTACK_QUERY_MIGRATION_COMPLETE.md)). However, the old Jotai store code still exists in [`/lib/store`](../lib/store) directory.

The problem occurs because:

1. **Old Jotai code uses async atoms** - The [`userAtom`](../lib/store/atoms/userAtom.ts) and [`gatewaysAtom`](../lib/store/atoms/gatewaysAtom.ts) are defined as async atoms using `atomWithRefresh`
2. **Async atoms in client components cause errors** - React 19/Next.js 15 doesn't allow async client components, and Jotai's async atoms trigger this error
3. **Module resolution conflict** - Even though the app imports from [`@/lib/query/hooks`](../lib/query/hooks), the old store code is somehow being executed, likely due to:
   - Cached build artifacts in `.next` directory
   - Hot module replacement (HMR) confusion
   - Webpack/Vite module resolution picking up old exports

### Evidence

**Old Store Structure (Should be removed):**
- [`/lib/store/atoms/userAtom.ts`](../lib/store/atoms/userAtom.ts) - Async Jotai atom
- [`/lib/store/atoms/gatewaysAtom.ts`](../lib/store/atoms/gatewaysAtom.ts) - Async Jotai atom  
- [`/lib/store/hooks/useUser.ts`](../lib/store/hooks/useUser.ts) - Contains `useRefreshUser()` causing the error
- [`/lib/store/provider.tsx`](../lib/store/provider.tsx) - JotaiProvider (not used in layout)

**New TanStack Query Structure (Currently in use):**
- [`/lib/query/hooks/useUser.ts`](../lib/query/hooks/useUser.ts) - TanStack Query hook
- [`/lib/query/hooks/useGateways.ts`](../lib/query/hooks/useGateways.ts) - TanStack Query hook
- [`/lib/query/provider.tsx`](../lib/query/provider.tsx) - QueryProvider (used in layout)

**Current Imports (Correct):**
- [`app/login/page.tsx`](../app/login/page.tsx) imports from `@/lib/query/hooks` ✅
- [`app/dashboard/page.tsx`](../app/dashboard/page.tsx) imports from `@/lib/query/hooks` ✅
- [`app/profile/page.tsx`](../app/profile/page.tsx) imports from `@/lib/query/hooks` ✅
- [`app/gateways/page.tsx`](../app/gateways/page.tsx) imports from `@/lib/query/hooks` ✅

## Solution

### Step 1: Remove Old Jotai Store Code

The old [`/lib/store`](../lib/store) directory needs to be removed or renamed to prevent module resolution conflicts.

**Option A: Delete (Recommended)**
```bash
rm -rf lib/store
```

**Option B: Archive (Safer)**
```bash
mv lib/store lib/store.old
```

### Step 2: Clear Next.js Build Cache

```bash
rm -rf .next
```

### Step 3: Restart Dev Server

```bash
npm run dev
```

### Step 4: Verify Fix

1. Navigate to `http://localhost:3001/login`
2. Verify the login form renders immediately (no infinite spinner)
3. Test login functionality
4. Check browser console for no errors

## Technical Details

### Why Async Atoms Cause Issues

Jotai's `atomWithRefresh` creates async atoms that return Promises. When used in client components with `'use client'` directive, React 19 throws an error because:

1. Client components cannot be async functions
2. Jotai's `useAtom` hook with async atoms internally uses React's `use()` hook
3. The `use()` hook with Promises in client components triggers the "async Client Component" error

### Why TanStack Query Works

TanStack Query handles async data differently:
- Uses `useQuery` hook that returns an object with `data`, `isLoading`, `error` states
- Doesn't make the component itself async
- Properly handles loading states without Promise unwrapping in render

## Migration Status

✅ **Completed:**
- All components migrated to TanStack Query hooks
- QueryProvider added to root layout
- Query keys centralized in [`lib/query/keys.ts`](../lib/query/keys.ts)
- All CRUD operations use mutations

❌ **Remaining:**
- Remove old Jotai store code
- Clear build cache
- Verify no lingering references

## Files to Remove

```
lib/store/
├── atoms/
│   ├── gatewaysAtom.ts
│   ├── index.ts
│   └── userAtom.ts
├── hooks/
│   ├── index.ts
│   ├── useGateways.ts
│   └── useUser.ts
├── index.ts
└── provider.tsx
```

## Expected Outcome

After applying the fix:
1. Login page loads instantly with form visible
2. No "async Client Component" errors in console
3. Authentication flow works correctly
4. All pages using `useUser()` and `useGateways()` work properly

## Prevention

To prevent similar issues in the future:
1. Always remove old code after migrations
2. Clear build cache after major refactors
3. Use explicit imports to avoid module resolution ambiguity
4. Document migration completion with cleanup checklist
