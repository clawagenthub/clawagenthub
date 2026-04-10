'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Gateway } from '@/lib/db/schema'

interface EditGatewayModalProps {
  isOpen: boolean
  onClose: () => void
  gateway: Gateway | null
  onSuccess: () => void
}

export function EditGatewayModal({ isOpen, onClose, gateway, onSuccess }: EditGatewayModalProps) {
  const [name, setName] = useState('')
  const [connectionType, setConnectionType] = useState<'localhost' | 'remote'>('localhost')
  const [url, setUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && gateway) {
      setName(gateway.name)
      setUrl(gateway.url)
      setAuthToken('')
      setConnectionType(gateway.url.includes('localhost') ? 'localhost' : 'remote')
    }
  }, [isOpen, gateway])

  const handleClose = () => {
    if (!loading) {
      setError('')
      onClose()
    }
  }

  const handleConnectionTypeChange = (type: 'localhost' | 'remote') => {
    setConnectionType(type)
    if (type === 'localhost') {
      setUrl('ws://127.0.0.1:18789')
    } else {
      setUrl('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!gateway) {
      setError('No gateway selected')
      setLoading(false)
      return
    }

    if (!name.trim()) {
      setError('Gateway name is required')
      setLoading(false)
      return
    }

    try {
      const body: { name: string; url: string; authToken?: string } = {
        name: name.trim(),
        url: url.trim(),
      }

      if (authToken.trim()) {
        body.authToken = authToken.trim()
      }

      const response = await fetch(`/api/gateways/${gateway.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update gateway')
      }

      setAuthToken('')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update gateway')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Gateway">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="gateway-name" className="block text-sm font-medium text-gray-700 mb-1">
            Gateway Name
          </label>
          <Input
            id="gateway-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Gateway"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Connection Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="connectionType"
                value="localhost"
                checked={connectionType === 'localhost'}
                onChange={() => handleConnectionTypeChange('localhost')}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-sm">Localhost</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="connectionType"
                value="remote"
                checked={connectionType === 'remote'}
                onChange={() => handleConnectionTypeChange('remote')}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-sm">Remote</span>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="gateway-url" className="block text-sm font-medium text-gray-700 mb-1">
            Gateway URL
          </label>
          <Input
            id="gateway-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://127.0.0.1:18789"
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Must start with ws:// or wss://
          </p>
        </div>

        <div>
          <label htmlFor="auth-token" className="block text-sm font-medium text-gray-700 mb-1">
            Auth Token
          </label>
          <Input
            id="auth-token"
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="Enter new token to update (leave empty to keep current)"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to keep current token. Find this in your OpenClaw config: <code className="bg-gray-100 px-1 rounded">gateway.auth.token</code>
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}