# Debugging Guide - Login Redirect Loop

## 🔍 How to Use the Logs

I've added comprehensive logging throughout the authentication flow. Here's what to look for:

## 📊 Log Categories

### 🔒 Middleware Logs (Server-Side)
**Format**: `🔒 [MIDDLEWARE timestamp] Request: METHOD path`

**What to check**:
- Is the middleware intercepting your requests?
- Does it find the session token in cookies?
- Is the session validation passing?
- Are redirects happening as expected?

**Example successful flow**:
```
🔒 [MIDDLEWARE 2024-...] Request: GET /dashboard
   🍪 Session token present: true
   🍪 Token preview: abc123xyz...
   🔍 Validating session token in database...
   ✅ Valid session found - User ID: user_123
   ✅ Session expires: 2024-03-08T19:00:00.000Z
   ✅ Access granted to: /dashboard
```

**Example redirect to login**:
```
🔒 [MIDDLEWARE 2024-...] Request: GET /dashboard
   🍪 Session token present: false
   ❌ No session token - redirecting to login
   ↪️  Redirecting to /login
```

### 🔐 Login API Logs (Server-Side)
**Format**: `🔐 [LOGIN API timestamp] POST /api/auth/login`

**What to check**:
- Is the login request reaching the API?
- Is the user found in the database?
- Is password verification succeeding?
- Is the session being created?
- Is the cookie being set?

**Example successful login**:
```
🔐 [LOGIN API 2024-...] POST /api/auth/login
   ✓ Database initialized
   📧 Login attempt for: user@example.com
   🔑 Password length: 12
   ✓ User found - ID: user_123
   ✓ Email: user@example.com
   ✓ Is superuser: true
   🔍 Verifying password...
   ✅ Password verification: true
   ✅ Creating session for user: user_123
   ✅ Session created - Token: abc123xyz...
   ✅ Session expires: 2024-03-08T19:00:00.000Z
   🍪 Setting session cookie...
   🍪 Cookie settings:
      - httpOnly: true
      - secure: false
      - sameSite: lax
      - maxAge: 86400 (24 hours)
      - path: /
   ✅ Login successful for: user@example.com
```

### 👤 Auth Me API Logs (Server-Side)
**Format**: `👤 [AUTH ME API timestamp] GET /api/auth/me`

**What to check**:
- Is the session token being sent with the request?
- Is the user being found from the session?
- Is the session still valid?

**Example successful auth check**:
```
👤 [AUTH ME API 2024-...] GET /api/auth/me
   ✓ Database initialized
   🍪 Session token present: true
   🍪 Token preview: abc123xyz...
   🔍 Looking up user from session...
   ✅ User found - ID: user_123
   ✅ Email: user@example.com
   ✅ Is superuser: true
   ✅ First password changed: true
```

### 🔐 Client Login Logs (Browser Console)
**Format**: `🔐 [CLIENT LOGIN] Starting login process...`

**What to check**:
- Is the login request being sent?
- What's the response status?
- Are cookies visible in document.cookie?
- Is the router refresh happening?

**Example successful client login**:
```
🔐 [CLIENT LOGIN] Starting login process...
   📧 Email: user@example.com
   📡 Response status: 200
   📡 Response ok: true
   ✅ Login successful!
   👤 User ID: user_123
   📧 Email: user@example.com
   🍪 Checking cookies...
   🍪 Document.cookie: (httpOnly cookies won't show here)
   🔄 Refreshing router...
   ↪️  Navigating to /dashboard...
```

### 👤 Client Dashboard Logs (Browser Console)
**Format**: `👤 [CLIENT DASHBOARD] Checking authentication...`

**What to check**:
- Is the auth check happening?
- What's the response from /api/auth/me?
- Is the user data being received?

**Example successful dashboard load**:
```
👤 [CLIENT DASHBOARD] Checking authentication...
   🍪 Document.cookie: (httpOnly cookies won't show here)
   📡 Fetching /api/auth/me...
   📡 Response status: 200
   📡 Response ok: true
   ✅ Auth check successful
   👤 User ID: user_123
   📧 Email: user@example.com
   🔒 Is superuser: true
   🔑 First password changed: true
```

## 🐛 Common Issues and What to Look For

### Issue 1: Cookie Not Being Set

**Symptoms**:
- Login API shows cookie being set
- But middleware doesn't find the cookie
- Client shows empty document.cookie

**What to check in logs**:
```
# Server logs show:
🔐 [LOGIN API] ...
   🍪 Setting session cookie...
   ✅ Login successful

# But next request shows:
🔒 [MIDDLEWARE] Request: GET /dashboard
   🍪 Session token present: false  ← PROBLEM!
```

**Possible causes**:
- Browser blocking cookies (check browser settings)
- Secure flag set to true in development (check cookie settings in login API logs)
- SameSite issues (check cookie settings)
- Domain mismatch

**Solution**:
- Check browser DevTools → Application → Cookies
- Verify cookie settings in login API logs
- Try in incognito mode
- Check if localhost vs 127.0.0.1 issue

### Issue 2: Session Token Invalid/Expired

**Symptoms**:
- Cookie is present
- But session validation fails

**What to check in logs**:
```
🔒 [MIDDLEWARE] Request: GET /dashboard
   🍪 Session token present: true
   🍪 Token preview: abc123xyz...
   🔍 Validating session token in database...
   ❌ Invalid or expired session token  ← PROBLEM!
```

**Possible causes**:
- Session expired (check expires_at in database)
- Database was reset but cookies remain
- Session was deleted

**Solution**:
- Clear browser cookies
- Check sessions table in database
- Verify session expiration time

### Issue 3: Redirect Loop

**Symptoms**:
- Login succeeds
- Redirects to dashboard
- Immediately redirects back to login

**What to check in logs**:
```
# Login succeeds:
🔐 [LOGIN API] ...
   ✅ Login successful

# Client navigates:
🔐 [CLIENT LOGIN] ...
   ↪️  Navigating to /dashboard...

# But middleware redirects:
🔒 [MIDDLEWARE] Request: GET /dashboard
   🍪 Session token present: false  ← Cookie not sent!
   ↪️  Redirecting to /login
```

**Possible causes**:
- Cookie not being sent with navigation
- Missing `credentials: 'include'` in fetch
- Router not refreshing before navigation

**Solution**:
- Verify `credentials: 'include'` in all fetch calls
- Check that `router.refresh()` is called before `router.push()`
- Clear browser cache and cookies

### Issue 4: Middleware Not Running

**Symptoms**:
- No middleware logs appearing
- Pages load without auth checks

**What to check**:
- Are you seeing ANY middleware logs?
- Check if middleware.ts is in the correct location (project root)

**Solution**:
- Verify `middleware.ts` exists at project root
- Restart the development server
- Check for syntax errors in middleware.ts

## 📋 Step-by-Step Debugging Process

### 1. Clear Everything
```bash
# Clear browser cookies
# In DevTools: Application → Cookies → Delete all

# Restart dev server
npm run dev
```

### 2. Attempt Login

Watch for this sequence in server logs:
```
1. 🔒 [MIDDLEWARE] Request: GET /login
   ✓ Public route allowed

2. 🔐 [LOGIN API] POST /api/auth/login
   ✅ Login successful
   🍪 Setting session cookie...

3. 🔒 [MIDDLEWARE] Request: GET /dashboard
   🍪 Session token present: true  ← MUST BE TRUE
   ✅ Valid session found
   ✅ Access granted
```

Watch for this sequence in browser console:
```
1. 🔐 [CLIENT LOGIN] Starting login process...
   ✅ Login successful!
   🔄 Refreshing router...
   ↪️  Navigating to /dashboard...

2. 👤 [CLIENT DASHBOARD] Checking authentication...
   ✅ Auth check successful
```

### 3. Check Browser DevTools

**Application Tab → Cookies**:
- Should see `session_token` cookie
- Check Domain, Path, Expires, HttpOnly, Secure, SameSite

**Network Tab**:
- Check `/api/auth/login` request
  - Response should be 200
  - Check Response Headers for `Set-Cookie`
- Check `/api/auth/me` request
  - Request Headers should include `Cookie: session_token=...`
  - Response should be 200

**Console Tab**:
- Look for all the log messages
- Check for any errors

## 🔧 Quick Fixes

### If cookies aren't being set:
1. Check login API logs for cookie settings
2. Verify `secure: false` in development
3. Try different browser
4. Check browser cookie settings

### If cookies aren't being sent:
1. Verify `credentials: 'include'` in all fetch calls
2. Check SameSite setting (should be 'lax')
3. Verify path is '/'

### If session validation fails:
1. Clear browser cookies
2. Check database sessions table
3. Verify session hasn't expired
4. Check system time is correct

### If middleware isn't running:
1. Verify middleware.ts is at project root
2. Restart dev server
3. Check for syntax errors
4. Verify config.matcher is correct

## 📞 Getting Help

When reporting issues, include:

1. **Server logs** (from terminal where dev server runs)
2. **Browser console logs** (from DevTools Console tab)
3. **Network tab** (screenshot of /api/auth/login and /api/auth/me)
4. **Cookies** (screenshot from Application → Cookies)
5. **Steps to reproduce**

## 🎯 Expected Successful Flow

```
USER ACTION: Click login button
  ↓
CLIENT: 🔐 [CLIENT LOGIN] Starting login process...
  ↓
SERVER: 🔐 [LOGIN API] POST /api/auth/login
        ✅ Login successful
        🍪 Setting session cookie
  ↓
CLIENT: ✅ Login successful!
        🔄 Refreshing router...
        ↪️  Navigating to /dashboard...
  ↓
SERVER: 🔒 [MIDDLEWARE] Request: GET /dashboard
        🍪 Session token present: true
        ✅ Valid session found
        ✅ Access granted
  ↓
CLIENT: 👤 [CLIENT DASHBOARD] Checking authentication...
  ↓
SERVER: 👤 [AUTH ME API] GET /api/auth/me
        ✅ User found
  ↓
CLIENT: ✅ Auth check successful
        [Dashboard renders]
  ↓
SUCCESS! 🎉
```

## 🚨 Red Flags

Watch for these in logs:

- ❌ `Session token present: false` after login
- ❌ `Invalid or expired session token` immediately after login
- ❌ `No session token found in cookies` on dashboard
- ❌ Missing middleware logs entirely
- ❌ Cookie settings showing `secure: true` in development
- ❌ Response status 401 on /api/auth/me after successful login

If you see any of these, focus on that specific issue first!
