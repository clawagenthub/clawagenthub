# Forced Password Change Feature

## Overview
This feature forces superusers to change their password on first login after database reset or initial setup. The password change modal is non-dismissible and will repeatedly appear until the password is changed.

## How It Works

### 1. Database Schema
A new field `first_password_changed` (BOOLEAN) has been added to the `users` table:
- Default value: `0` (false)
- Set to `1` (true) after the user changes their password
- Tracked in the database to prevent circumvention

### 2. User Flow

#### Initial Setup
1. Admin runs `npm run db:reset` to reset the database
2. Admin creates a superuser via the `/setup` page
3. New superuser is created with `first_password_changed = 0`

#### First Login
1. Superuser logs in with initial credentials
2. Dashboard loads and checks `user.first_password_changed`
3. If `false`, a **non-dismissible** modal appears immediately
4. User cannot:
   - Close the modal with the X button (hidden)
   - Click outside the modal to dismiss it
   - Press ESC to close it
   - Access the dashboard until password is changed

#### Password Change
1. User enters current password and new password
2. New password must meet security requirements:
   - At least 8 characters
   - Contains uppercase and lowercase letters
   - Contains at least one number
   - Different from current password
3. On successful change:
   - `first_password_changed` is set to `1` in database
   - All existing sessions are invalidated
   - New session is created
   - Modal closes
   - User can now access the dashboard

#### Subsequent Logins
- User logs in normally
- No forced password change modal appears
- Dashboard is immediately accessible

## Technical Implementation

### Files Modified

#### Database & Schema
- [`lib/db/migrations/002_add_first_password_changed.sql`](../lib/db/migrations/002_add_first_password_changed.sql) - Migration to add new field
- [`lib/db/schema.ts`](../lib/db/schema.ts) - Updated User interface
- [`lib/db/schema.d.ts`](../lib/db/schema.d.ts) - Updated type definitions

#### Backend APIs
- [`lib/setup/index.ts`](../lib/setup/index.ts) - Set `first_password_changed = 0` for new superusers
- [`app/api/auth/login/route.ts`](../app/api/auth/login/route.ts) - Include field in login response
- [`app/api/auth/me/route.ts`](../app/api/auth/me/route.ts) - Include field in user data
- [`app/api/auth/change-password/route.ts`](../app/api/auth/change-password/route.ts) - Set field to `1` on password change

#### Frontend Components
- [`components/ui/modal.tsx`](../components/ui/modal.tsx) - Added `dismissible` prop for non-dismissible modals
- [`components/auth/change-password-form.tsx`](../components/auth/change-password-form.tsx) - Added `isForced` prop for forced mode
- [`app/dashboard/page.tsx`](../app/dashboard/page.tsx) - Implemented forced password change logic

## API Changes

### Login Response
```typescript
{
  success: true,
  user: {
    id: string,
    email: string,
    is_superuser: boolean,
    first_password_changed: boolean  // NEW
  }
}
```

### Auth Me Response
```typescript
{
  user: {
    id: string,
    email: string,
    is_superuser: boolean,
    first_password_changed: boolean  // NEW
  }
}
```

## Security Features

1. **Database-Backed**: Flag is stored in database, not in session/cookies
2. **Non-Dismissible Modal**: User cannot bypass the password change requirement
3. **Session Invalidation**: All sessions are invalidated after password change
4. **Password Validation**: Enforces strong password requirements
5. **Superuser Only**: Only affects superuser accounts (highest privilege)

## Testing the Feature

### Manual Testing Steps

1. **Reset Database**
   ```bash
   npm run db:reset
   ```

2. **Create Superuser**
   - Visit the setup URL shown in console
   - Create a superuser account
   - Note: `first_password_changed` will be `0`

3. **First Login**
   - Log in with the superuser credentials
   - Verify that the password change modal appears immediately
   - Try to close the modal (should not be possible):
     - Click outside modal
     - Press ESC key
     - Look for X button (should be hidden)

4. **Change Password**
   - Enter current password
   - Enter new password (meeting requirements)
   - Confirm new password
   - Submit the form
   - Verify modal closes and dashboard is accessible

5. **Subsequent Login**
   - Log out
   - Log in again with new password
   - Verify no forced password change modal appears
   - Dashboard should be immediately accessible

### Database Verification

Check the database directly:
```bash
npm run db:check
```

Or query manually:
```sql
SELECT id, email, is_superuser, first_password_changed FROM users;
```

Expected results:
- Before password change: `first_password_changed = 0`
- After password change: `first_password_changed = 1`

## Migration Strategy

### For Existing Installations

The migration [`002_add_first_password_changed.sql`](../lib/db/migrations/002_add_first_password_changed.sql) handles existing users:

1. Adds the `first_password_changed` column with default `0`
2. Updates all existing users to `first_password_changed = 1`
3. Only new superusers created after migration will have `first_password_changed = 0`

This prevents forcing existing users to change their passwords.

### For Fresh Installations

Fresh installations will:
1. Run all migrations including the new field
2. Create superusers with `first_password_changed = 0`
3. Force password change on first login

## Troubleshooting

### Modal Doesn't Appear
- Check that user is a superuser: `is_superuser = true`
- Check database: `first_password_changed = 0`
- Check browser console for errors
- Verify API response includes `first_password_changed` field

### Modal Won't Close
- This is expected behavior if password hasn't been changed
- Verify password meets all requirements
- Check API response for errors
- Ensure password change was successful in database

### Password Change Fails
- Verify current password is correct
- Ensure new password meets requirements:
  - At least 8 characters
  - Contains uppercase letter
  - Contains lowercase letter
  - Contains number
  - Different from current password

## Configuration

No additional configuration is required. The feature is automatically enabled for all superuser accounts.

## Future Enhancements

Potential improvements:
- Configurable password requirements
- Password expiration policy
- Password history (prevent reuse)
- Email notification on password change
- Admin dashboard to view password change status
- Configurable grace period before forcing change

## Related Documentation

- [Password Change Quickstart](./PASSWORD_CHANGE_QUICKSTART.md)
- [Security Password Change](./SECURITY_PASSWORD_CHANGE.md)
- [Database Documentation](./DATABASE.md)
- [Implementation Plan](../plans/forced-password-change-plan.md)
