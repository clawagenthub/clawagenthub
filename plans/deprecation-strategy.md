# Deprecation Strategy - Gateway Connection Fix

## Overview

Instead of deleting old files, we'll move them to `deprecated/` folders and make API routes return 404.

---

## Folder Structure

### Create Deprecated Folders

```
app/api/deprecated/          ← New folder for deprecated API routes
lib/deprecated/              ← New folder for deprecated library files
components/deprecated/       ← New folder for deprecated components
```

---

## Files to Deprecate

### 1. API Routes → `app/api/deprecated/`

#### Move: `app/api/gateways/pair/route.ts`
**To**: `app/api/deprecated/gateways-pair-route.ts`

Add deprecation header and return 404:

```typescript
/**
 * @deprecated This endpoint is deprecated as of 2026-03-08
 * 
 * Reason: Replaced by token-based authentication
 * Use instead: POST /api/gateways/[id]/connect
 * 
 * This endpoint references the removed 'pairing_status' column
 * and is no longer functional.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Use POST /api/gateways/[id]/connect instead.',
      deprecated: true,
      replacementEndpoint: '/api/gateways/[id]/connect'
    },
    { status: 404 }
  )
}
```

#### Move: `app/api/gateways/check-paired/route.ts`
**To**: `app/api/deprecated/gateways-check-paired-route.ts`

```typescript
/**
 * @deprecated This endpoint is deprecated as of 2026-03-08
 * 
 * Reason: Device pairing system removed
 * Use instead: POST /api/gateways/[id]/connect
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Use POST /api/gateways/[id]/connect instead.',
      deprecated: true,
      replacementEndpoint: '/api/gateways/[id]/connect'
    },
    { status: 404 }
  )
}
```

#### Move: `app/api/gateways/[id]/pairing-status/route.ts`
**To**: `app/api/deprecated/gateways-pairing-status-route.ts`

```typescript
/**
 * @deprecated This endpoint is deprecated as of 2026-03-08
 * 
 * Reason: pairing_status column removed from database
 * Use instead: Check gateway status via GET /api/gateways
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Check gateway status via GET /api/gateways instead.',
      deprecated: true,
      replacementEndpoint: '/api/gateways'
    },
    { status: 404 }
  )
}
```

#### Update: `app/api/gateways/connect-with-token/route.ts`
**Keep in place but add deprecation notice and fix pairing_status reference**

Add at top:
```typescript
/**
 * @deprecated This endpoint is deprecated as of 2026-03-08
 * 
 * Reason: Functionality merged into /api/gateways/[id]/connect
 * Use instead: POST /api/gateways/[id]/connect
 * 
 * This endpoint is kept for backward compatibility but will be removed in future versions.
 */
```

Fix line 139-141 (remove pairing_status):
```typescript
// BEFORE
db.prepare(
  'UPDATE gateways SET status = ?, pairing_status = ?, last_connected_at = ?, last_error = NULL, updated_at = ? WHERE id = ?'
).run('connected', 'approved', new Date().toISOString(), new Date().toISOString(), gatewayId)

// AFTER
db.prepare(
  'UPDATE gateways SET status = ?, last_connected_at = ?, last_error = NULL, updated_at = ? WHERE id = ?'
).run('connected', new Date().toISOString(), new Date().toISOString(), gatewayId)
```

---

### 2. Components → `components/deprecated/`

#### Move: `components/gateway/pairing-modal.tsx`
**To**: `components/deprecated/pairing-modal.tsx`

Add deprecation header:

```typescript
/**
 * @deprecated This component is deprecated as of 2026-03-08
 * 
 * Reason: Device pairing flow removed in favor of direct token-based connection
 * Use instead: Direct connection via POST /api/gateways/[id]/connect
 * 
 * This component references deprecated API endpoints:
 * - /api/gateways/pair
 * - /api/gateways/[id]/pairing-status
 * 
 * DO NOT USE THIS COMPONENT IN NEW CODE
 */

'use client'

// ... rest of file unchanged
```

---

### 3. Library Files → `lib/deprecated/`

#### Move: `lib/gateway/device-identity.ts` (if exists)
**To**: `lib/deprecated/device-identity.ts`

```typescript
/**
 * @deprecated This module is deprecated as of 2026-03-08
 * 
 * Reason: Device identity system removed in favor of token-based authentication
 * 
 * This module generated Ed25519 key pairs for device identification,
 * which is no longer used in the simplified authentication flow.
 * 
 * DO NOT USE THIS MODULE IN NEW CODE
 */

// ... rest of file unchanged
```

---

### 4. Migration Scripts → `scripts/deprecated/`

Create `scripts/deprecated/` folder and move:

- `scripts/migrate-device-identities.ts` → `scripts/deprecated/migrate-device-identities.ts`
- `scripts/fix-device-identity.ts` → `scripts/deprecated/fix-device-identity.ts`
- `scripts/apply-migration-005.ts` → `scripts/deprecated/apply-migration-005.ts`
- `scripts/apply-migration-006.ts` → `scripts/deprecated/apply-migration-006.ts`
- `scripts/apply-migration-007.ts` → `scripts/deprecated/apply-migration-007.ts`

Add to each:
```typescript
/**
 * @deprecated This script is deprecated as of 2026-03-08
 * 
 * Reason: Device identity system removed
 * 
 * This script is kept for historical reference only.
 * DO NOT RUN THIS SCRIPT
 */

console.error('This script is deprecated and should not be run.')
process.exit(1)
```

---

## Implementation Steps

### Step 1: Create Deprecated Folders

```bash
mkdir -p githubprojects/clawhub/app/api/deprecated
mkdir -p githubprojects/clawhub/lib/deprecated
mkdir -p githubprojects/clawhub/components/deprecated
mkdir -p githubprojects/clawhub/scripts/deprecated
```

### Step 2: Move and Update API Routes

For each deprecated API route:
1. Add deprecation comment at top
2. Replace implementation with 404 response
3. Move to `app/api/deprecated/`
4. Delete original folder if empty

### Step 3: Move Components

1. Add deprecation comment to `pairing-modal.tsx`
2. Move to `components/deprecated/`

### Step 4: Move Library Files

1. Add deprecation comment to `device-identity.ts` (if exists)
2. Move to `lib/deprecated/`

### Step 5: Move Scripts

1. Add deprecation comment and exit code to each script
2. Move to `scripts/deprecated/`

### Step 6: Create Deprecation Index

Create `app/api/deprecated/README.md`:

```markdown
# Deprecated API Endpoints

This folder contains deprecated API endpoints that have been replaced by simpler token-based authentication.

## Deprecated Endpoints

| Old Endpoint | Status | Replacement |
|-------------|--------|-------------|
| POST /api/gateways/pair | 404 | POST /api/gateways/[id]/connect |
| POST /api/gateways/check-paired | 404 | POST /api/gateways/[id]/connect |
| GET /api/gateways/[id]/pairing-status | 404 | GET /api/gateways |
| POST /api/gateways/connect-with-token | Deprecated | POST /api/gateways/[id]/connect |

## Reason for Deprecation

The device pairing system was removed in favor of direct token-based authentication:
- Simpler user experience
- Fewer API calls
- No device identity management
- Direct WebSocket connection with token

## Migration Guide

If your code uses these endpoints, update to:

```typescript
// OLD (deprecated)
await fetch('/api/gateways/pair', {
  method: 'POST',
  body: JSON.stringify({ gatewayId })
})

// NEW (recommended)
await fetch(`/api/gateways/${gatewayId}/connect`, {
  method: 'POST'
})
```

## Timeline

- **Deprecated**: 2026-03-08
- **Removal**: TBD (will be announced)
```

---

## Updated File Structure

```
app/
├── api/
│   ├── deprecated/                          ← NEW
│   │   ├── README.md                        ← NEW
│   │   ├── gateways-pair-route.ts          ← MOVED (returns 404)
│   │   ├── gateways-check-paired-route.ts  ← MOVED (returns 404)
│   │   └── gateways-pairing-status-route.ts ← MOVED (returns 404)
│   └── gateways/
│       ├── add/route.ts                     ← UPDATED (token required)
│       ├── connect-with-token/route.ts      ← DEPRECATED (but functional)
│       └── [id]/
│           └── connect/route.ts             ← ACTIVE (use this)

components/
├── deprecated/                              ← NEW
│   └── pairing-modal.tsx                    ← MOVED
└── gateway/
    ├── add-gateway-modal.tsx                ← UPDATED (token required)
    └── gateway-card.tsx                     ← UPDATED (direct connect)

lib/
├── deprecated/                              ← NEW
│   └── device-identity.ts                   ← MOVED (if exists)
└── gateway/
    ├── client.ts                            ← ACTIVE
    └── manager.ts                           ← ACTIVE

scripts/
├── deprecated/                              ← NEW
│   ├── migrate-device-identities.ts         ← MOVED
│   ├── fix-device-identity.ts               ← MOVED
│   ├── apply-migration-005.ts               ← MOVED
│   ├── apply-migration-006.ts               ← MOVED
│   └── apply-migration-007.ts               ← MOVED
└── apply-migration-009.ts                   ← ACTIVE (run this)
```

---

## Benefits of This Approach

1. **Backward Compatibility**: Old code gets clear 404 with migration instructions
2. **Historical Reference**: Files preserved for understanding past implementation
3. **Clear Documentation**: Deprecation comments explain why and what to use instead
4. **Gradual Migration**: Teams can migrate at their own pace
5. **No Breaking Changes**: Existing deployments continue to work (with 404s)

---

## Testing Deprecated Endpoints

After moving files, test that they return 404:

```bash
# Should return 404 with deprecation message
curl -X POST http://localhost:7777/api/gateways/pair \
  -H "Content-Type: application/json" \
  -d '{"gatewayId": "test"}'

# Expected response:
{
  "message": "This endpoint is deprecated. Use POST /api/gateways/[id]/connect instead.",
  "deprecated": true,
  "replacementEndpoint": "/api/gateways/[id]/connect"
}
```

---

## Summary

Instead of deleting:
- ✅ Move to `deprecated/` folders
- ✅ Add deprecation comments
- ✅ API routes return 404 with helpful message
- ✅ Scripts exit immediately with error
- ✅ Components marked as deprecated
- ✅ Documentation explains migration path
