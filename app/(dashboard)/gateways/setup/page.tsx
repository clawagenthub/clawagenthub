  'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import logger, { logCategories } from '@/lib/logger/index.js'


interface DiscoveredGateway {
  url: string
  reachable: boolean
  requiresAuth: boolean
  authToken?: string
  health?: {
    ok: boolean
    version?: string
  }
  error?: string
}

export default function GatewaySetupPage() {
  const router = useRouter()
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredGateway[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: 'Local OpenClaw Gateway',
    url: 'ws://localhost:18789',
    authToken: '',
  })

  // Auto-discover on mount
  useEffect(() => {
    handleAutoDiscover()
  }, [])

  const handleAutoDiscover = async () => {
    setDiscovering(true)
    setError('')
    setDiscovered([])

    try {
      const response = await fetch('/api/gateways/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error('Discovery failed')
      }

      const data = await response.json()
      setDiscovered(data.discovered || [])

      if (data.discovered && data.discovered.length > 0) {
        const first = data.discovered[0]
        setFormData({
          name: 'Local OpenClaw Gateway',
          url: first.url,
          authToken: first.authToken || '',
        })
      }
    } catch (err) {
      logger.error('Auto-discovery error:', err)
      setError(err instanceof Error ? err.message : 'Auto-discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const handleDiscoverWithToken = async () => {
    if (!formData.authToken) {
      setError('Please enter an auth token')
      return
    }

    setDiscovering(true)
    setError('')

    try {
      const response = await fetch('/api/gateways/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authToken: formData.authToken }),
      })

      if (!response.ok) {
        throw new Error('Discovery failed')
      }

      const data = await response.json()

      if (data.discovered && data.discovered.length > 0) {
        const first = data.discovered[0]
        setFormData((prev) => ({
          ...prev,
          url: first.url,
        }))
        setDiscovered(data.discovered)
      } else {
        setError('No gateway found with that auth token. Please check your token and try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const handleSaveGateway = async () => {
    if (!formData.name || !formData.url || !formData.authToken) {
      setError('Please fill in all fields')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add gateway')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/chat')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save gateway')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Connect to OpenClaw Gateway</h1>
        <p className="text-gray-600">
          Connect ClawAgentHub to your local OpenClaw Gateway to access your AI agents.
        </p>
      </div>

      {/* Auto-Discovery Section */}
      <Card className="mb-6 p-6">
        <h2 className="text-xl font-semibold mb-2">🔍 Auto-Discovery</h2>
        <p className="text-sm text-gray-600 mb-4">
          Automatically detect OpenClaw Gateway running on your local machine
        </p>

        {discovering && (
          <div className="flex items-center gap-2 text-blue-600 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Searching for local gateways...</span>
          </div>
        )}

        {!discovering && discovered.length === 0 && (
          <div className="p-3 mb-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            No gateway found automatically. The gateway might require authentication.
          </div>
        )}

        {discovered.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <span className="text-xl">✓</span>
              <span className="font-medium">Gateway discovered!</span>
            </div>
            {discovered.map((gw, idx) => (
              <div
                key={idx}
                className="p-3 border rounded bg-green-50 border-green-200"
              >
                <div className="font-medium">{gw.url}</div>
                <div className="text-sm text-gray-600">
                  {gw.requiresAuth ? 'Requires authentication' : 'No authentication required'}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleAutoDiscover} disabled={discovering} variant="secondary">
            {discovering ? 'Searching...' : 'Retry Discovery'}
          </Button>
        </div>
      </Card>

      {/* Configuration Section */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Gateway Configuration</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Gateway Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Local Gateway"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Gateway URL</label>
            <Input
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="ws://localhost:18789"
              disabled={discovered.length > 0}
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: ws://localhost:18789 or ws://127.0.0.1:18789
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Auth Token</label>
            <Input
              type="password"
              value={formData.authToken}
              onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
              placeholder="Your gateway auth token"
            />
            <p className="text-xs text-gray-500 mt-1">
              Find this in <code className="bg-gray-100 px-1 rounded">~/.openclaw/openclaw.json</code> under{' '}
              <code className="bg-gray-100 px-1 rounded">gateway.auth.token</code>
            </p>
          </div>

          {discovered.length === 0 && formData.authToken && (
            <Button onClick={handleDiscoverWithToken} disabled={discovering} variant="secondary" className="w-full">
              {discovering ? 'Testing Connection...' : 'Test Connection'}
            </Button>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              ✓ Gateway connected successfully! Redirecting to chat...
            </div>
          )}

          <Button
            onClick={handleSaveGateway}
            disabled={saving || !formData.authToken || success}
            className="w-full"
          >
            {saving ? 'Connecting...' : success ? 'Connected!' : 'Connect Gateway'}
          </Button>
        </div>
      </Card>

      {/* Help Section */}
      <Card className="mt-6 p-6 bg-blue-50 border-blue-200">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">Need Help?</h2>
        <div className="text-sm text-blue-800 space-y-3">
          <div>
            <p className="font-medium mb-1">1. Make sure OpenClaw Gateway is running:</p>
            <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto">openclaw gateway</pre>
          </div>

          <div>
            <p className="font-medium mb-1">2. Find your auth token:</p>
            <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto">
              cat ~/.openclaw/openclaw.json | grep -A 2 '"auth"'
            </pre>
          </div>

          <div>
            <p className="font-medium mb-1">3. Check gateway status:</p>
            <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto">openclaw status</pre>
          </div>
        </div>
      </Card>
    </div>
  )
}
