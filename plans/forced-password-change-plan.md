# Forced Password Change on First Login - Implementation Plan

## Overview
Implement a feature that forces superusers to change their password on first login after database reset or initial setup. The password change modal will be non-dismissible and will repeatedly appear until the password is changed.

## Requirements
- When a superuser is created (via setup or db-reset), mark them as requiring password change
- On first login, show a mandatory password change modal
- Modal cannot be closed or dismissed until password is changed
- After password change, user can continue using the application normally
- Track password change status in the database

## Architecture Changes

### 1. Database Schema Changes

#### Add New Field to Users Table
- **Field**: `first_password_changed`
- **Type**: `BOOLEAN`
- **Default**: `0` (false)
- **Purpose**: Track whether user has changed their initial password

#### Migration Strategy
Since this is an existing project, we need to:
1. Create a new migration file: `002_add_first_password_changed.sql`
2. Add the column with default value `0`
3. Update existing users to have `first_password_changed = 1` (they already have passwords)
4. New superusers created after this will have `first_password_changed = 0`

### 2. Type Definition Updates

#### Files to Update:
- [`lib/db/schema.ts`](githubprojects/clawhub/lib/db/schema.ts:1)
- [`lib/db/schema.d.ts`](githubprojects/clawhub/lib/db/schema.d.ts:1)

#### Changes:
```typescript
export interface User {
  id: string
  email: string
  password_hash: string
  is_superuser: boolean
  first_password_changed: boolean  // NEW FIELD
  created_at: string
  updated_at: string
}

export interface UserPublic {
  id: string
  email: string
  is_superuser: boolean
  first_password_changed: boolean  // NEW FIELD
  created_at: string
}
```

### 3. Backend API Changes

#### A. Setup Creation ([`app/api/setup/create/route.ts`](githubprojects/clawhub/app/api/setup/create/route.ts:1))
- When creating superuser via setup, set `first_password_changed = 0`
- Update [`lib/setup/index.ts`](githubprojects/clawhub/lib/setup/index.ts:1) `createSuperuser()` function

#### B. Login API ([`app/api/auth/login/route.ts`](githubprojects/clawhub/app/api/auth/login/route.ts:1))
- Include `first_password_changed` in the response
- Return this flag so frontend knows to show modal

#### C. Auth Me API ([`app/api/auth/me/route.ts`](githubprojects/clawhub/app/api/auth/me/route.ts:1))
- Include `first_password_changed` in user data
- Used when dashboard checks authentication status

#### D. Change Password API ([`app/api/auth/change-password/route.ts`](githubprojects/clawhub/app/api/auth/change-password/route.ts:1))
- After successful password change, set `first_password_changed = 1`
- Update the database field along with password_hash

### 4. Frontend Component Changes

#### A. Modal Component Enhancement
Create a new variant or prop for non-dismissible modals:
- **File**: [`components/ui/modal.tsx`](githubprojects/clawhub/components/ui/modal.tsx:1)
- **Changes**:
  - Add `dismissible` prop (default: true)
  - When `dismissible = false`:
    - Hide close button (X)
    - Disable backdrop click
    - Disable ESC key
    - Prevent modal from closing

#### B. Dashboard Page ([`app/dashboard/page.tsx`](githubprojects/clawhub/app/dashboard/page.tsx:1))
- Check `user.first_password_changed` status
- If `false` and user is superuser:
  - Show password change modal immediately
  - Make it non-dismissible
  - Don't allow closing until password changed
- After successful password change:
  - Refresh user data
  - Close modal
  - Allow normal dashboard usage

#### C. Change Password Form ([`components/auth/change-password-form.tsx`](githubprojects/clawhub/components/auth/change-password-form.tsx:1))
- Add optional prop `isForced` to customize UI/messaging
- When forced:
  - Show warning message about mandatory change
  - Hide cancel button (or disable it)
  - Update messaging to indicate this is required

### 5. Database Reset Script

#### File: [`scripts/db-reset.ts`](githubprojects/clawhub/scripts/db-reset.ts:1)
- No changes needed - migrations will handle schema
- New superusers created after reset will automatically have `first_password_changed = 0`

## Implementation Flow

### User Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Admin runs db-reset                                      │
│    - Database is cleared                                    │
│    - Migrations run (including new field)                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Admin creates superuser via /setup                       │
│    - User created with first_password_changed = false       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Superuser logs in for first time                         │
│    - Login API returns first_password_changed = false       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Dashboard loads                                          │
│    - Checks user.first_password_changed                     │
│    - Shows NON-DISMISSIBLE password change modal            │
│    - User cannot close modal or use dashboard               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. User changes password                                    │
│    - Validates new password                                 │
│    - Updates password_hash                                  │
│    - Sets first_password_changed = true                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Modal closes, dashboard accessible                       │
│    - User can now use the application normally              │
│    - Future logins won't show forced modal                  │
└─────────────────────────────────────────────────────────────┘
```

### Technical Flow

```
Login Request
     │
     ▼
[Login API] ──────────────────────────────────────┐
     │                                             │
     │ Query user from DB                          │
     │ (includes first_password_changed field)     │
     │                                             │
     ▼                                             │
Return user data with                             │
first_password_changed flag                       │
     │                                             │
     ▼                                             │
[Dashboard Component]                             │
     │                                             │
     │ useEffect on mount                          │
     │                                             │
     ▼                                             │
Check: user.is_superuser &&                       │
       !user.first_password_changed?              │
     │                                             │
     ├─ YES ──▶ Show non-dismissible modal        │
     │          User MUST change password          │
     │                                             │
     └─ NO ───▶ Normal dashboard access           │
                                                   │
Password Change Request                           │
     │                                             │
     ▼                                             │
[Change Password API]                             │
     │                                             │
     │ Validate current password                  │
     │ Validate new password                      │
     │                                             │
     ▼                                             │
UPDATE users SET                                  │
  password_hash = ?,                              │
  first_password_changed = 1,  ◀─────────────────┘
  updated_at = NOW()
WHERE id = ?
     │
     ▼
Return success
     │
     ▼
[Dashboard Component]
     │
     │ Refresh user data
     │ Close modal
     │
     ▼
Normal dashboard access
```

## File Changes Summary

### New Files
1. `lib/db/migrations/002_add_first_password_changed.sql` - Migration for new field

### Modified Files
1. `lib/db/schema.ts` - Add field to User interface
2. `lib/db/schema.d.ts` - Add field to all User-related types
3. `lib/setup/index.ts` - Set first_password_changed = 0 for new superusers
4. `app/api/auth/login/route.ts` - Include field in response
5. `app/api/auth/me/route.ts` - Include field in response
6. `app/api/auth/change-password/route.ts` - Update field on password change
7. `components/ui/modal.tsx` - Add non-dismissible variant
8. `components/auth/change-password-form.tsx` - Add forced mode UI
9. `app/dashboard/page.tsx` - Implement forced password change logic

## Security Considerations

1. **Non-Dismissible Modal**: Ensures users cannot bypass password change
2. **Database Tracking**: Persistent flag prevents circumvention via session manipulation
3. **API Validation**: Backend enforces password requirements
4. **Session Refresh**: After password change, new session is created for security
5. **Superuser Only**: Only affects superuser accounts (highest privilege)

## Testing Checklist

- [ ] Fresh database reset creates users with `first_password_changed = 0`
- [ ] Existing users (if any) have `first_password_changed = 1`
- [ ] Superuser login shows non-dismissible modal on first login
- [ ] Modal cannot be closed via X button, backdrop, or ESC key
- [ ] Password change validates all requirements
- [ ] After password change, `first_password_changed` is set to `1`
- [ ] Modal closes after successful password change
- [ ] Subsequent logins don't show the modal
- [ ] Regular users (non-superuser) are not affected
- [ ] API endpoints return correct `first_password_changed` status

## Migration Strategy for Existing Installations

For existing ClawAgentHub installations:
1. Run migration to add column with default `0`
2. Update all existing users to `first_password_changed = 1`
3. Only new superusers created after migration will have `first_password_changed = 0`
4. This prevents forcing existing users to change passwords

## Alternative Approaches Considered

### Approach 1: Session-based flag (Rejected)
- Store flag in session/cookie
- **Problem**: Can be cleared by user, bypassing requirement

### Approach 2: Temporary password flag (Rejected)
- Mark password as "temporary"
- **Problem**: Semantically unclear, harder to maintain

### Approach 3: Database field (Selected) ✓
- Persistent, secure, clear intent
- Cannot be bypassed by client-side manipulation
- Easy to query and maintain

## Conclusion

This implementation provides a secure, user-friendly way to enforce password changes for superusers on first login. The non-dismissible modal ensures compliance while the database tracking prevents circumvention.
