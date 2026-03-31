# Gateway Health Check Feature - Implementation Plan

## Overview

Add a "Check Health" button to gateway cards that verifies the gateway connection and authentication are working properly, then shows a success toast notification.

## Requirements

1. **Health Check Button**: Add button to gateway card UI
2. **Authentication Verification**: Actually test if auth token works with gateway
3. **Success Toast**: Show notification when health check passes
4. **Error Handling**: Show clear error if health check fails

---

## What is a Gateway Health Check?

A health check should verify:
1. ✅ Gateway is reachable (WebSocket connection)
2. ✅ Authentication token is valid
3. ✅ Gateway responds to requests
4. ✅ Connection is stable

This is different from just showing "Connected" status - it actively tests the connection.

---

## Implementation Plan

### 1. Create Health Check API Endpoint

**File**: `app/api/gateways/[id]/health/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager.js'
import type { Gateway } from '@/lib/db/schema.js'

/**
 * Health check endpoint for gateway
 * Tests if the gateway is reachable and authentication is working
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureDatabase()

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)
    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabase()
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    const gatewayId = params.id

    // Get gateway from database
    const gateway = db
      .prepare('SELECT * FROM gateways WHERE id = ? AND workspace_id = ?')
      .get(gatewayId, session.current_workspace_id) as Gateway | undefined

    if (!gateway) {
      return NextResponse.json(
        { message: 'Gateway not found' },
        { status: 404 }
      )
    }

    // Check if gateway has auth token
    if (!gateway.auth_token) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'Gateway has no auth token configured',
          checks: {
            hasToken: false,
            isConnected: false,
            canAuthenticate: false
          }
        },
        { status: 200 }
      )
    }

    const manager = getGatewayManager()
    
    // Check if gateway is connected
    const isConnected = manager.isConnected(gatewayId)
    
    if (!isConnected) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'Gateway is not connected',
          checks: {
            hasToken: true,
            isConnected: false,
            canAuthenticate: false
          }
        },
        { status: 200 }
      )
    }

    // Try to get gateway client and verify it's authenticated
    const client = manager.getClient(gatewayId)
    
    if (!client) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'Gateway client not found',
          checks: {
            hasToken: true,
            isConnected: false,
            canAuthenticate: false
          }
        },
        { status: 200 }
      )
    }

    // Check if client is authenticated
    const isAuthenticated = client.isAuthenticated()
    
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'Gateway authentication failed',
          checks: {
            hasToken: true,
            isConnected: true,
            canAuthenticate: false
          }
        },
        { status: 200 }
      )
    }

    // All checks passed!
    return NextResponse.json({
      healthy: true,
      message: 'Gateway is healthy and authenticated',
      checks: {
        hasToken: true,
        isConnected: true,
        canAuthenticate: true
      },
      gateway: {
        id: gateway.id,
        name: gateway.name,
        url: gateway.url,
        status: gateway.status,
        lastConnected: gateway.last_connected_at
      }
    })

  } catch (error) {
    console.error('Error checking gateway health:', error)
    return NextResponse.json(
      {
        healthy: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
```

### 2. Update GatewayClient to Expose Authentication Status

**File**: `lib/gateway/client.ts`

Add method to check if client is authenticated:

```typescript
/**
 * Check if the client is authenticated with the gateway
 */
public isAuthenticated(): boolean {
  return this.authenticated
}
```

### 3. Update GatewayManager to Expose Client

**File**: `lib/gateway/manager.ts`

Add method to get client:

```typescript
/**
 * Get the gateway client for a specific gateway
 */
public getClient(gatewayId: string): GatewayClient | undefined {
  return this.connections.get(gatewayId)
}
```

### 4. Create Toast Notification Component

**File**: `components/ui/toast.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
  onClose: () => void
}

export function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Wait for fade out animation
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  }[type]

  const icon = {
    success: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    )
  }[type]

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white transition-opacity duration-300 ${bgColor} ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {icon}
      <span className="font-medium">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(onClose, 300)
        }}
        className="ml-2 hover:opacity-80"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

// Toast container for managing multiple toasts
export function useToast() {
  const [toasts, setToasts] = useState<Array<{
    id: string
    message: string
    type: 'success' | 'error' | 'info'
  }>>([])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return { toasts, showToast, removeToast }
}
```

### 5. Update Gateway Card Component

**File**: `components/gateway/gateway-card.tsx`

Add health check button and toast:

```typescript
import { useState } from 'react'
import { Toast } from '@/components/ui/toast'

// ... existing code ...

export function GatewayCard({ gateway, onConnect, onDelete }: GatewayCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  // ... existing handleDelete code ...

  const handleHealthCheck = async () => {
    setChecking(true)
    try {
      const response = await fetch(`/api/gateways/${gateway.id}/health`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.healthy) {
        setToast({
          message: '✓ Gateway is healthy and authenticated!',
          type: 'success'
        })
      } else {
        setToast({
          message: `✗ Health check failed: ${data.message}`,
          type: 'error'
        })
      }
    } catch (error) {
      setToast({
        message: `✗ Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      })
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <Card className="p-6">
        {/* ... existing card content ... */}
        
        <div className="flex flex-col gap-2 ml-4">
          {gateway.status === 'connected' && (
            <Button
              onClick={handleHealthCheck}
              disabled={checking}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50"
            >
              {checking ? 'Checking...' : 'Check Health'}
            </Button>
          )}
          
          {gateway.status === 'disconnected' || gateway.status === 'error' ? (
            <Button
              onClick={() => onConnect(gateway)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Connect
            </Button>
          ) : null}
          
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Card>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
```

---

## UI Mockup

### Gateway Card with Health Check Button

```
┌─────────────────────────────────────────────────┐
│ 🖥️  Localgateway                                │
│     ws://127.0.0.1:18789                        │
│                                                 │
│ Status: Connected ✅                            │
│ Last connected: 3/8/2026, 8:45:23 AM           │
│                                                 │
│                          [Check Health]         │
│                          [Disconnect]           │
│                          [Delete]               │
└─────────────────────────────────────────────────┘
```

### Success Toast

```
┌─────────────────────────────────────────┐
│ ✓ Gateway is healthy and authenticated! │ [X]
└─────────────────────────────────────────┘
```

### Error Toast

```
┌─────────────────────────────────────────┐
│ ✗ Health check failed: Not authenticated│ [X]
└─────────────────────────────────────────┘
```

---

## Testing

### Test Cases

1. **Healthy Gateway**:
   - Gateway connected with valid token
   - Click "Check Health"
   - ✅ Should show success toast

2. **Disconnected Gateway**:
   - Gateway not connected
   - Button should not appear

3. **Invalid Token**:
   - Gateway connected but token invalid
   - Click "Check Health"
   - ✅ Should show error toast

4. **Network Error**:
   - Gateway unreachable
   - Click "Check Health"
   - ✅ Should show error toast

---

## Benefits

1. **Verification**: Actually tests if auth is working
2. **User Feedback**: Clear success/error messages
3. **Debugging**: Helps identify connection issues
4. **Confidence**: Users know their setup is correct

---

## Next Steps

1. Create health check API endpoint
2. Update GatewayClient with isAuthenticated() method
3. Update GatewayManager with getClient() method
4. Create Toast component
5. Update GatewayCard with health check button
6. Test all scenarios
