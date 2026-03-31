# Deprecated API Endpoints

This folder contains deprecated API endpoints that have been replaced by simpler token-based authentication.

## Deprecated Endpoints

| Old Endpoint | Status | Replacement | Reason |
|-------------|--------|-------------|--------|
| POST /api/gateways/pair | Returns 404 | POST /api/gateways/[id]/connect | Device pairing system removed |
| GET /api/gateways/[id]/pairing-status | Returns 404 | GET /api/gateways | pairing_status column removed |
| POST /api/gateways/connect-with-token | Deprecated but functional | POST /api/gateways/[id]/connect | Functionality merged |

## Reason for Deprecation

The device pairing system was removed on **2026-03-08** in favor of direct token-based authentication:

### Old Flow (Complex)
1. Add gateway (token optional)
2. Click "Connect"
3. Device pairing modal appears
4. User approves in OpenClaw UI
5. Poll for pairing status
6. Connection established

### New Flow (Simple)
1. Add gateway (token **required**)
2. Click "Connect"
3. Connection established immediately

## Benefits

- **Simpler UX**: 3 steps instead of 7
- **Faster**: Direct connection with token
- **Fewer bugs**: Less complexity = fewer edge cases
- **Easier to understand**: Token auth is familiar to developers
- **Less code**: Removed ~500 lines of pairing code

## Migration Guide

If your code uses these endpoints, update to the new flow:

### Before (Deprecated)
```typescript
// Add gateway without token
await fetch('/api/gateways/add', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Gateway',
    url: 'ws://127.0.0.1:18789',
    authToken: null  // Optional
  })
})

// Initiate pairing
await fetch('/api/gateways/pair', {
  method: 'POST',
  body: JSON.stringify({ gatewayId })
})

// Poll for status
await fetch(`/api/gateways/${gatewayId}/pairing-status`)
```

### After (Recommended)
```typescript
// Add gateway with required token
await fetch('/api/gateways/add', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Gateway',
    url: 'ws://127.0.0.1:18789',
    authToken: 'your-token-here'  // Required
  })
})

// Connect directly
await fetch(`/api/gateways/${gatewayId}/connect`, {
  method: 'POST'
})
```

## Database Changes

The following columns were removed from the `gateways` table:
- `device_id`
- `device_key`
- `device_public_key`
- `device_private_key`
- `pairing_status` ← This was causing the "no such column" error

## Timeline

- **Deprecated**: 2026-03-08
- **Migration 009**: Applied to remove device pairing columns
- **Removal**: TBD (will be announced in advance)

## Files Moved to Deprecated

### API Routes
- `app/api/deprecated/gateways-pair-route.ts` (original: `app/api/gateways/pair/route.ts`)

### Components
- `components/deprecated/pairing-modal.tsx` (original: `components/gateway/pairing-modal.tsx`)

### Scripts
- Migration scripts for device identity (005, 006, 007) moved to `scripts/deprecated/`

## Support

If you encounter issues migrating to the new flow, please:
1. Check the [Quick Start Guide](../../../docs/QUICK_START_TOKEN_AUTH.md)
2. Review the [Implementation Plan](../../../plans/fix-gateway-connection-errors.md)
3. Ensure your OpenClaw config has `gateway.auth.token` set
