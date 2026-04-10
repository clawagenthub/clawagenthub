'use client'

import { Button } from '@/components/ui/button'
import { GatewayCard } from '@/components/gateway/gateway-card'
import { AddGatewayModal } from '@/components/gateway/add-gateway-modal'

interface Gateway {
  id: string
  name: string
  url: string
  status?: string
}

interface GatewayTabProps {
  gateways: Gateway[]
  gatewaysLoading: boolean
  showAddModal: boolean
  onConnect: (gateway: Gateway) => void
  onDelete: (gatewayId: string) => void
  onUpdate: () => void
  onAddSuccess: () => void
  onShowAddModal: (show: boolean) => void
}

export function GatewayTab({
  gateways,
  gatewaysLoading,
  showAddModal,
  onConnect,
  onDelete,
  onUpdate,
  onAddSuccess,
  onShowAddModal,
}: GatewayTabProps) {
  return (
    <div className="space-y-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Gateways</h2>
          <p className="mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>Manage your OpenClaw Gateway connections</p>
        </div>
        <Button onClick={() => onShowAddModal(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <svg className="mr-2 inline-block h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Gateway
        </Button>
      </div>

      {gatewaysLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4" style={{ color: 'rgb(var(--text-secondary))' }}>Loading gateways...</p>
        </div>
      ) : gateways.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No gateways</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding your first gateway.</p>
          <div className="mt-6">
            <Button onClick={() => onShowAddModal(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <svg className="mr-2 inline-block h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Gateway
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {gateways.map((gateway) => (
            <GatewayCard
              key={gateway.id}
              gateway={gateway}
              onConnect={onConnect}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}

      <AddGatewayModal
        isOpen={showAddModal}
        onClose={() => onShowAddModal(false)}
        onSuccess={onAddSuccess}
      />
    </div>
  )
}
