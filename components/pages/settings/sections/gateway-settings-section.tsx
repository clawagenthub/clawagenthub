'use client'

import { Button } from '@/components/ui/button'
import { GatewayCard } from '@/components/gateway/gateway-card'
import { AddGatewayModal } from '@/components/gateway/add-gateway-modal'
import type { Gateway } from '@/lib/db/schema'

interface GatewaySettingsSectionProps {
  gateways: Gateway[]
  gatewaysLoading: boolean
  refresh: () => void
  onConnect: (gateway: Gateway) => void
  onDelete: (gatewayId: string) => void
}

export function GatewaySettingsSection({
  gateways,
  gatewaysLoading,
  refresh,
  onConnect,
  onDelete,
}: GatewaySettingsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Gateways</h2>
          <p className="mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>Manage your OpenClaw Gateway connections</p>
        </div>
        <Button onClick={() => {}} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
          <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Gateway
        </Button>
      </div>
      {gatewaysLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4" style={{ color: 'rgb(var(--text-secondary))' }}>Loading gateways...</p>
        </div>
      ) : gateways.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No gateways</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding your first gateway.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gateways.map((gateway) => (
            <GatewayCard key={gateway.id} gateway={gateway} onConnect={onConnect} onDelete={onDelete} onUpdate={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}
