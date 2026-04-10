'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { CommandBlock } from './CommandBlock'
import logger, { logCategories as _logCategories } from '@/lib/logger/index.js'


interface PairingModalProps {
  isOpen: boolean
  onClose: () => void
  gatewayName: string
  gatewayUrl: string
  gatewayId: string
  onSuccess: () => void
}

type TimeoutId = ReturnType<typeof setTimeout>

// Sub-components for smaller file

function SuccessBanner() {
  return (
    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center">
      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      <span className="font-medium">Gateway connected successfully!</span>
    </div>
  )
}

function PendingBanner({ deviceId }: { deviceId: string }) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
      <div className="flex items-start gap-3">
        <svg className="animate-spin h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="flex-1">
          <p className="font-semibold mb-1">Pairing Request Pending Approval</p>
          {deviceId && <p className="text-sm mb-2">Device ID: <code className="bg-yellow-100 px-1 rounded font-mono text-xs">{deviceId}</code></p>}
          <p className="text-sm">Waiting for approval on the gateway. Please approve this device in the OpenClaw Control UI or via CLI.</p>
          <p className="text-xs mt-2 text-yellow-700">This page will automatically update when the pairing is approved.</p>
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({ error }: { error: string }) {
  return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
}

function ConnectionMethodTabs({ connectionMethod, onChange }: { connectionMethod: 'pairing' | 'token', onChange: (method: 'pairing' | 'token') => void }) {
  return (
    <div className="flex border-b border-gray-200">
      <button
        onClick={() => onChange('pairing')}
        className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${connectionMethod === 'pairing' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
      >
        Device Pairing
      </button>
      <button
        onClick={() => onChange('token')}
        className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${connectionMethod === 'token' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
      >
        Connect with Token
      </button>
    </div>
  )
}

function TokenConnectionForm({ gatewayToken, onTokenChange, checking }: {
  gatewayToken: string
  onTokenChange: (token: string) => void
  checking: boolean
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <label htmlFor="gateway-token" className="block text-sm font-medium text-gray-700 mb-2">Gateway Token</label>
        <input
          id="gateway-token"
          type="text"
          value={gatewayToken}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder="Enter your gateway auth token"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={checking}
        />
        <p className="mt-2 text-sm text-gray-600">
          The gateway token can be found in your OpenClaw configuration file (<code className="bg-gray-200 px-1 rounded text-xs">openclaw.json</code>) under <code className="bg-gray-200 px-1 rounded text-xs">gateway.auth.token</code>
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h5 className="text-sm font-medium text-blue-900 mb-2">How to get your token:</h5>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Check your OpenClaw config: <code className="bg-blue-100 px-1 rounded">openclaw config get gateway.auth.token</code></li>
          <li>Or view the config file at <code className="bg-blue-100 px-1 rounded">~/.openclaw/config.json</code></li>
          <li>Copy the token value and paste it above</li>
        </ol>
      </div>
    </div>
  )
}

function SpinnerButton({ checking: _checking, label }: { checking: boolean, label: string }) {
  return (
    <span className="flex items-center">
      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {label}
    </span>
  )
}

function GatewayInfo({ gatewayName, gatewayUrl }: { gatewayName: string, gatewayUrl: string }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-medium text-blue-900 mb-2">{gatewayName}</h3>
      <p className="text-sm text-blue-700">{gatewayUrl}</p>
    </div>
  )
}

function PairingInstructions({ copiedCommand, onCopy }: { copiedCommand: string | null, onCopy: (text: string, id: string) => void }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start">
        <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="text-sm text-yellow-800"><strong>Note:</strong> Pairing requests expire after 5 minutes</div>
      </div>

      <h4 className="font-medium text-gray-900">Pairing Instructions:</h4>
      
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-gray-700 mb-2"><span className="font-semibold">1.</span> Open your OpenClaw Control UI (web dashboard)</p>
          <div className="ml-4 text-xs text-gray-600">
            <p>• Usually at: <code className="bg-gray-200 px-1 rounded">http://localhost:18789</code></p>
            <p>• Or your gateway&apos;s IP: <code className="bg-gray-200 px-1 rounded">http://&lt;gateway-ip&gt;:18789</code></p>
          </div>
        </div>

        <div>
          <p className="text-gray-700 mb-2"><span className="font-semibold">2.</span> In the Control UI, navigate to the Devices/Nodes section</p>
          <div className="ml-4 text-xs text-gray-600">
            <p>• Look for pending device pairing requests</p>
            <p>• You should see this ClawAgentHub instance waiting for approval</p>
          </div>
        </div>

        <div>
          <p className="text-gray-700 mb-2"><span className="font-semibold">3.</span> Click &quot;Approve&quot; on the pending device request</p>
        </div>

        <div>
          <p className="text-gray-700 mb-2"><span className="font-semibold">4.</span> Click &quot;I Paired&quot; button below to verify the connection</p>
        </div>

        <details className="mt-3 bg-gray-100 rounded p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">Alternative: Approve via Terminal (CLI)</summary>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs text-gray-600 mb-2">List pending devices:</p>
              <CommandBlock command="openclaw devices list" commandId="list" copiedCommand={copiedCommand} onCopy={onCopy} size="sm" />
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-2">Approve the latest request:</p>
              <CommandBlock command="openclaw devices approve --latest" commandId="approve-latest" copiedCommand={copiedCommand} onCopy={onCopy} size="sm" />
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-2">Or approve by specific device ID:</p>
              <CommandBlock command="openclaw devices approve <deviceId>" commandId="approve-id" copiedCommand={copiedCommand} onCopy={onCopy} size="sm" />
            </div>
          </div>
        </details>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">Troubleshooting</summary>
        <div className="mt-3 space-y-3 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-700">Can&apos;t access Control UI?</p>
            <p className="ml-4">• Verify gateway is running: <code className="bg-gray-200 px-1 rounded text-xs">openclaw gateway status</code></p>
            <p className="ml-4">• Check if port 18789 is accessible</p>
            <p className="ml-4">• For remote access, ensure firewall allows the port</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">No pending requests shown?</p>
            <p className="ml-4">• The pairing request may have expired (&gt;5 minutes)</p>
            <p className="ml-4">• Close this dialog and try pairing again</p>
            <p className="ml-4">• Check CLI: <code className="bg-gray-200 px-1 rounded text-xs">openclaw devices list</code></p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Connection still fails?</p>
            <p className="ml-4 mb-2">Check gateway logs for errors:</p>
            <CommandBlock command="journalctl --user -u openclaw -f" commandId="logs" copiedCommand={copiedCommand} onCopy={onCopy} size="sm" />
          </div>
        </div>
      </details>
    </div>
  )
}

export function PairingModal({
  isOpen,
  onClose,
  gatewayName,
  gatewayUrl,
  gatewayId,
  onSuccess,
}: PairingModalProps) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [pairingStatus, setPairingStatus] = useState<'not_started' | 'pending' | 'approved' | 'rejected'>('not_started')
  const [deviceId, setDeviceId] = useState<string>('')
  const [connectionMethod, setConnectionMethod] = useState<'pairing' | 'token'>('pairing')
  const [gatewayToken, setGatewayToken] = useState<string>('')
  const pollingIntervalRef = useRef<TimeoutId | null>(null)

  const copyToClipboard = async (text: string, commandId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCommand(commandId)
      setTimeout(() => setCopiedCommand(null), 2000)
    } catch (err) {
      logger.error('Failed to copy:', err)
    }
  }

  useEffect(() => {
    if (!isOpen || pairingStatus !== 'pending') {
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    const pollPairingStatus = async () => {
      try {
        const response = await fetch(`/api/gateways/${gatewayId}/pairing-status`)
        const data = await response.json()

        if (data.pairingStatus === 'approved' && data.hasToken) {
          setPairingStatus('approved')
          setSuccess(true)
          if (pollingIntervalRef.current) {
            clearTimeout(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setTimeout(() => {
            onSuccess()
            onClose()
          }, 2000)
        }
      } catch (err) {
        logger.error('Failed to poll pairing status:', err)
      }
    }

    pollingIntervalRef.current = setTimeout(pollPairingStatus, 2000)

    return () => {
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [isOpen, pairingStatus, gatewayId, onSuccess, onClose])

  const handleCheckPaired = async () => {
    setError('')
    setChecking(true)

    try {
      const response = await fetch('/api/gateways/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate pairing')
      }

      if (data.status === 'pending') {
        setPairingStatus('pending')
        setDeviceId(data.deviceId || '')
        setError('')
      } else if (data.status === 'connected') {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
          setSuccess(false)
        }, 1500)
      } else {
        setError(data.error || 'Gateway is not connected yet. Please approve the pairing request on your gateway.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check pairing status')
    } finally {
      setChecking(false)
    }
  }

  const handleConnectWithToken = async () => {
    setError('')
    setChecking(true)

    if (!gatewayToken.trim()) {
      setError('Please enter a gateway token')
      setChecking(false)
      return
    }

    try {
      const response = await fetch('/api/gateways/connect-with-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayId, gatewayToken: gatewayToken.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to connect with token')
      }

      if (data.connected) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          onClose()
          setSuccess(false)
        }, 1500)
      } else {
        setError(data.error || 'Connection failed. Please check your token and try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect with token')
    } finally {
      setChecking(false)
    }
  }

  const handleClose = () => {
    if (!checking) {
      setError('')
      setSuccess(false)
      setGatewayToken('')
      setConnectionMethod('pairing')
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Connect Gateway">
      <div className="space-y-4">
        <GatewayInfo gatewayName={gatewayName} gatewayUrl={gatewayUrl} />

        {!success && pairingStatus !== 'pending' && (
          <ConnectionMethodTabs connectionMethod={connectionMethod} onChange={setConnectionMethod} />
        )}

        {success ? (
          <SuccessBanner />
        ) : pairingStatus === 'pending' ? (
          <PendingBanner deviceId={deviceId} />
        ) : connectionMethod === 'token' ? (
          <>
            {error && <ErrorBanner error={error} />}
            <TokenConnectionForm
              gatewayToken={gatewayToken}
              onTokenChange={setGatewayToken}
              checking={checking}
              onSubmit={handleConnectWithToken}
              onCancel={handleClose}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" onClick={handleClose} disabled={checking} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConnectWithToken}
                disabled={checking || !gatewayToken.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {checking ? <SpinnerButton checking={checking} label="Connecting..." /> : 'Connect'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {error && <ErrorBanner error={error} />}
            <PairingInstructions copiedCommand={copiedCommand} onCopy={copyToClipboard} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" onClick={handleClose} disabled={checking} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCheckPaired}
                disabled={checking}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {checking ? <SpinnerButton checking={checking} label="Checking..." /> : 'I Paired'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}