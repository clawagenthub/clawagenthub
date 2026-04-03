'use client'

import { useState } from 'react'
import { StatusBadge } from './status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Toast } from '@/components/ui/toast'
import { EditGatewayModal } from './edit-gateway-modal'
import type { Gateway } from '@/lib/db/schema'

interface GatewayCardProps {
  gateway: Gateway
  onConnect: (gateway: Gateway) => void
  onDelete: (gatewayId: string) => void
  onUpdate: () => void
}

export function GatewayCard({ gateway, onConnect, onDelete, onUpdate }: GatewayCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

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

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${gateway.name}"?`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/gateways/${gateway.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to delete gateway')
      }

      onDelete(gateway.id)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete gateway')
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <>
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{gateway.name}</h3>
              <p className="text-sm text-gray-500">{gateway.url}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Status:</span>
              <StatusBadge status={gateway.status} />
            </div>
            
            {gateway.last_connected_at && (
              <div className="text-sm text-gray-600">
                Last connected: {formatDate(gateway.last_connected_at)}
              </div>
            )}

            {gateway.last_error && gateway.status === 'error' && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                Error: {gateway.last_error}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 ml-4">
          <Button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Edit
          </Button>
          
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
      </div>
    </Card>

    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)}
      />
    )}
    
    <EditGatewayModal
      isOpen={showEditModal}
      onClose={() => setShowEditModal(false)}
      gateway={gateway}
      onSuccess={() => {
        onUpdate()
        setShowEditModal(false)
      }}
    />
    </>
  )
}
