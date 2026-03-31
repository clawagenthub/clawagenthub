# Infinite Console Loop Fix Plan

## Problem Summary

The ClawAgentHub application is experiencing an infinite loop where `/api/auth/me` is being called continuously, flooding the console with logs. This is causing performance issues and making the application unusable.

## Root Cause Analysis

### Location
[`lib/store/hooks/useUser.ts:44`](../lib/store/hooks/useUser.ts:44)

### The Issue
```typescript
useEffect(() => {
  intervalRef.current = setInterval(() => {
    console.log('[useUser] Auto-refreshing user data...')
    refreshUser()
  }, REFRESH_INTERVAL)

  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }
}, [refreshUser])  // ❌ PROBLEM: refreshUser in dependency array
```

### Why This Causes an Infinite Loop

1. **Jotai Setter Reference Changes**: The `refreshUser` function from `useAtom(userAtom)` can have its reference change on re-renders
2. **Effect Re-execution**: When `refreshUser` reference changes, the `useEffect` runs again
3. **New Interval Created**: A new interval is created (old one is cleared)
4. **Trigger Re-render**: The interval calls `refreshUser()`, which fetches data and updates the atom
5. **Cycle Repeats**: The atom update causes a re-render, potentially changing `refreshUser` reference again
6. **Infinite Loop**: Steps 2-5 repeat continuously

### Impact

- **Performance**: Hundreds of API calls per minute
- **Database Load**: Excessive database queries
- **User Experience**: Console spam, potential browser slowdown
- **Server Load**: Unnecessary HTTP requests

## Solution

### Fix Strategy

Remove `refreshUser` from the `useEffect` dependency array. The interval callback doesn't need to track `refreshUser` changes because:

1. The interval is set up once on component mount
2. The callback captures the `refreshUser` function when created
3. We want the interval to run independently, not recreate on every render
4. The cleanup function properly clears the interval on unmount

### Code Change

**File**: [`lib/store/hooks/useUser.ts`](../lib/store/hooks/useUser.ts:44)

```typescript
// BEFORE (causes infinite loop)
useEffect(() => {
  intervalRef.current = setInterval(() => {
    console.log('[useUser] Auto-refreshing user data...')
    refreshUser()
  }, REFRESH_INTERVAL)

  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }
}, [refreshUser])  // ❌ Problem

// AFTER (fixed)
useEffect(() => {
  intervalRef.current = setInterval(() => {
    console.log('[useUser] Auto-refreshing user data...')
    refreshUser()
  }, REFRESH_INTERVAL)

  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }
}, [])  // ✅ Empty dependency array - run once on mount
```

### Alternative Approach (if needed)

If we need to ensure the latest `refreshUser` is always used, we could use a ref pattern:

```typescript
const refreshUserRef = useRef(refreshUser)

useEffect(() => {
  refreshUserRef.current = refreshUser
}, [refreshUser])

useEffect(() => {
  intervalRef.current = setInterval(() => {
    console.log('[useUser] Auto-refreshing user data...')
    refreshUserRef.current()
  }, REFRESH_INTERVAL)

  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }
}, [])  // Empty array - interval set once
```

However, the simple fix (empty array) should be sufficient for this use case.

## Verification Steps

### 1. Check Other Hooks
✅ **Verified**: [`useGateways.ts`](../lib/store/hooks/useGateways.ts) does not have any `useEffect` hooks, so it's not affected.

### 2. Test the Fix
After applying the fix:
1. Start the dev server
2. Navigate to `/dashboard`
3. Monitor the console
4. Verify `/api/auth/me` is only called:
   - Once on initial page load
   - Every 60 seconds (as intended by `REFRESH_INTERVAL`)
   - Not continuously in a loop

### 3. Functional Testing
Ensure the following still works correctly:
- User authentication state is maintained
- Password change detection works
- Manual refresh via `refreshUser()` still functions
- Session expiry is detected within 60 seconds

## Implementation Steps

1. Open [`lib/store/hooks/useUser.ts`](../lib/store/hooks/useUser.ts)
2. Locate line 44 with the `useEffect` dependency array
3. Change `[refreshUser]` to `[]`
4. Save the file
5. The dev server should hot-reload automatically
6. Verify the console shows the loop has stopped
7. Test user authentication flows

## Expected Outcome

After the fix:
- `/api/auth/me` called once on mount
- `/api/auth/me` called every 60 seconds via interval
- No infinite loop
- Clean console output
- Normal application performance

## Related Files

- [`lib/store/hooks/useUser.ts`](../lib/store/hooks/useUser.ts) - Main fix location
- [`lib/store/atoms/userAtom.ts`](../lib/store/atoms/userAtom.ts) - User atom definition
- [`app/dashboard/page.tsx`](../app/dashboard/page.tsx) - Uses `useUser()` hook
- [`app/profile/page.tsx`](../app/profile/page.tsx) - Uses `useUser()` hook
- [`app/gateways/page.tsx`](../app/gateways/page.tsx) - Uses `useUser()` hook

## Notes

- This is a common React pitfall when using hooks with changing references
- Jotai's setter functions can have unstable references in some scenarios
- Always be cautious with `useEffect` dependencies, especially with functions
- Consider using ESLint's `react-hooks/exhaustive-deps` rule, but understand when to disable it
