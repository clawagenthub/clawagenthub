# Token-Only Authentication Implementation Guide

## Quick Fix: Add Token to Existing Gateway

### Option A: Direct Database Update (Fastest)

```bash
# 1. Find your gateway ID
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, url, auth_token FROM gateways;"

# 2. Update with your token (replace YOUR_GATEWAY_ID)
sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN', updated_at = datetime('now') WHERE id = 'YOUR_GATEWAY_ID';"

# 3. Verify
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, auth_token FROM gateways WHERE id = 'YOUR_GATEWAY_ID';"

# 4. Restart ClawAgentHub and test
```

### Option B: Interactive Script

Create `scripts/add-gateway-token.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Quick fix script to add auth token to existing gateway
 * Usage: npm run script scripts/add-gateway-token.ts
 */

import { getDatabase } from '../lib/db/index.js'
import * as readline from 'readline'

interface Gateway {
  id: string
  name: string
  url: string
  auth_token: string | null
  status: string
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function main() {
  console.log('🔧 Gateway Token Update Script\n')
  
  const db = getDatabase()
  
  // List all gateways
  const gateways = db
    .prepare('SELECT id, name, url, auth_token, status FROM gateways')
    .all() as Gateway[]
  
  if (gateways.length === 0) {
    console.log('❌ No gateways found in database')
    rl.close()
    return
  }
  
  console.log('📋 Available Gateways:\n')
  gateways.forEach((gateway, index) => {
    console.log(`${index + 1}. ${gateway.name}`)
    console.log(`   URL: ${gateway.url}`)
    console.log(`   Status: ${gateway.status}`)
    console.log(`   Has Token: ${gateway.auth_token ? '✅ Yes' : '❌ No'}`)
    console.log(`   ID: ${gateway.id}`)
    console.log()
  })
  
  // Prompt for gateway selection
  const selectionStr = await question('Select gateway number (or press Enter for first): ')
  const selection = selectionStr.trim() ? parseInt(selectionStr) - 1 : 0
  
  if (selection < 0 || selection >= gateways.length) {
    console.log('❌ Invalid selection')
    rl.close()
    return
  }
  
  const selectedGateway = gateways[selection]
  console.log(`\n✅ Selected: ${selectedGateway.name}`)
  
  // Prompt for token
  const token = await question('\nEnter gateway auth token (from OpenClaw config): ')
  
  if (!token.trim()) {
    console.log('❌ Token cannot be empty')
    rl.close()
    return
  }
  
  // Confirm
  const confirm = await question(`\n⚠️  Update gateway "${selectedGateway.name}" with token "${token}"? (yes/no): `)
  
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled')
    rl.close()
    return
  }
  
  // Update database
  try {
    db.prepare(
      'UPDATE gateways SET auth_token = ?, updated_at = ? WHERE id = ?'
    ).run(token.trim(), new Date().toISOString(), selectedGateway.id)
    
    console.log('\n✅ Gateway token updated successfully!')
    console.log('\n📝 Next steps:')
    console.log('   1. Restart your ClawAgentHub server')
    console.log('   2. Try connecting to the gateway')
    console.log('   3. Check logs for "hasToken: true"')
  } catch (error) {
    console.error('❌ Failed to update gateway:', error)
  }
  
  rl.close()
}

main().catch(console.error)
```

Run with:
```bash
npm run script scripts/add-gateway-token.ts
```

---

## UI Implementation: Token Input Component

### Step 1: Create Token Input Component

Create `app/components/GatewayTokenInput.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface GatewayTokenInputProps {
  gatewayId: string
  gatewayName: string
  onSuccess: () => void
}

export function GatewayTokenInput({ 
  gatewayId, 
  gatewayName,
  onSuccess 
}: GatewayTokenInputProps) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/gateways/connect-with-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gatewayId, 
          gatewayToken: token.trim() 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to connect')
      }

      console.log('✅ Gateway connected successfully')
      onSuccess()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed'
      console.error('❌ Connection error:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Connect with Token
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Enter the authentication token from your OpenClaw gateway configuration.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="token" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Gateway Token
          </label>
          <input
            id="token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your OpenClaw gateway token"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Find this in your OpenClaw config: <code className="bg-gray-100 px-1 rounded">gateway.auth.token</code>
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting...' : 'Connect with Token'}
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 p-3">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> Your OpenClaw gateway must have <code className="bg-blue-100 px-1 rounded">allowInsecureAuth: true</code> in the controlUi settings to use token-only authentication.
        </p>
      </div>
    </div>
  )
}
```

### Step 2: Add to Gateway Management Page

Update your gateway detail/management page to show the token input:

```typescript
// In your gateway page component (e.g., app/gateways/[id]/page.tsx)
import { GatewayTokenInput } from '@/components/GatewayTokenInput'
import { useRouter } from 'next/navigation'

export default function GatewayPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  // ... your existing code to fetch gateway data

  return (
    <div>
      {/* Your existing gateway UI */}
      
      {/* Show token input when gateway is disconnected and has no token */}
      {gateway.status === 'disconnected' && !gateway.auth_token && (
        <div className="mt-6">
          <GatewayTokenInput 
            gatewayId={gateway.id}
            gatewayName={gateway.name}
            onSuccess={() => {
              // Refresh the page to show updated status
              router.refresh()
            }}
          />
        </div>
      )}

      {/* Show token update option for connected gateways */}
      {gateway.auth_token && (
        <div className="mt-6">
          <details className="rounded-lg border border-gray-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Update Gateway Token
            </summary>
            <div className="mt-4">
              <GatewayTokenInput 
                gatewayId={gateway.id}
                gatewayName={gateway.name}
                onSuccess={() => router.refresh()}
              />
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
```

### Step 3: Update Add Gateway Form

Modify your add gateway form to include token field:

```typescript
// In your add gateway form component
'use client'

import { useState } from 'react'

export function AddGatewayForm() {
  const [formData, setFormData] = useState({
    name: '',
    url: 'ws://127.0.0.1:18789',
    authToken: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const response = await fetch('/api/gateways/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    // Handle response...
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Gateway Name
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
        />
      </div>

      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-700">
          Gateway URL
        </label>
        <input
          id="url"
          type="text"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="ws://127.0.0.1:18789"
          required
        />
      </div>

      <div>
        <label htmlFor="authToken" className="block text-sm font-medium text-gray-700">
          Authentication Token (Optional)
        </label>
        <input
          id="authToken"
          type="text"
          value={formData.authToken}
          onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="Enter gateway token for immediate connection"
        />
        <p className="mt-1 text-xs text-gray-500">
          You can add this later if you don't have it now
        </p>
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Add Gateway
      </button>
    </form>
  )
}
```

---

## Testing Your Implementation

### 1. Verify Token in Database

```bash
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, auth_token FROM gateways;"
```

Expected output:
```
gateway-id-123|Local Gateway|YOUR_GATEWAY_TOKEN
```

### 2. Check Connection Logs

After connecting, you should see:

```
[GatewayClient] Initializing with token-only auth (no device identity) { url: 'ws://127.0.0.1:18789', hasAuthToken: true }
[GatewayClient] Connecting with origin: http://localhost:7777
[GatewayClient] WebSocket connection opened { url: 'ws://127.0.0.1:18789' }
[GatewayClient] Received connect.challenge { nonce: '...' }
[GatewayClient] Sending connect request (token-only auth) { hasToken: true, nonce: '...' }
[GatewayClient] Connection accepted
```

Key indicators:
- ✅ `hasAuthToken: true` (not false)
- ✅ `hasToken: true` (not false)
- ✅ `Connection accepted` (not error)

### 3. Verify OpenClaw Config

Your `.openclaw/openclaw.json` should have:

```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "YOUR_GATEWAY_TOKEN"
    },
    "controlUi": {
      "allowInsecureAuth": true,
      "allowedOrigins": [
        "http://localhost:7777",
        "http://127.0.0.1:7777"
      ]
    }
  }
}
```

### 4. Test Connection Flow

1. **Add token to gateway** (using script or UI)
2. **Restart ClawAgentHub server**
3. **Navigate to gateway page**
4. **Click "Connect" or refresh**
5. **Check status changes to "connected"**
6. **Try listing agents**

---

## Troubleshooting

### Still Getting `hasToken: false`?

**Problem**: Token not being passed from database to client

**Solution**:
```bash
# Check database
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, auth_token FROM gateways;"

# If auth_token is NULL, update it
sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN' WHERE id = 'YOUR_ID';"

# Restart server
```

### Getting `UNAUTHORIZED` Error?

**Problem**: Token mismatch between ClawAgentHub and OpenClaw

**Solution**:
1. Check OpenClaw config: `cat .openclaw/openclaw.json | grep -A 5 '"auth"'`
2. Check ClawAgentHub database: `sqlite3 ~/.clawhub/clawhub.db "SELECT auth_token FROM gateways;"`
3. Ensure they match exactly (case-sensitive)

### Getting `DEVICE_IDENTITY_REQUIRED`?

**Problem**: Token is NULL or empty

**Solution**:
```bash
# Verify token exists
sqlite3 ~/.clawhub/clawhub.db "SELECT id, name, COALESCE(auth_token, 'NULL') as token FROM gateways;"

# If NULL, add token
sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN' WHERE auth_token IS NULL;"
```

### Connection Works But Can't List Agents?

**Problem**: Connected but authorization issue

**Solution**:
- Check token has correct permissions in OpenClaw
- Verify `role: 'operator'` and `scopes: ['operator.admin']` in client
- Check OpenClaw logs for authorization errors

---

## Summary

**The Fix**: Your gateway needs the auth token stored in the database so it can be passed to the OpenClaw gateway during connection.

**Quick Solution**:
```bash
sqlite3 ~/.clawhub/clawhub.db "UPDATE gateways SET auth_token = 'YOUR_GATEWAY_TOKEN' WHERE id = 'YOUR_GATEWAY_ID';"
```

**Proper Solution**: Implement the UI components above to allow users to add/update tokens through the interface.

**Verification**: After fix, logs should show `hasToken: true` and connection should succeed without `DEVICE_IDENTITY_REQUIRED` error.
