'use client'

import React from 'react'
import type { AgentInfo } from '@/lib/db/schema'

interface AgentSelectorProps {
  agents: AgentInfo[]
  selectedAgent: AgentInfo | null
  onSelect: (agent: AgentInfo) => void
  loading?: boolean
  error?: string
  isConnected?: boolean
}

export function AgentSelector({ agents, selectedAgent, onSelect, loading = false, error, isConnected = false }: AgentSelectorProps) {
  return (
    <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
      <label
        className="block text-sm font-medium mb-2"
        style={{ color: 'rgb(var(--text-primary))' }}
      >
        Select Agent
      </label>
      <select
        value={selectedAgent ? `${selectedAgent.gatewayId}:${selectedAgent.agentId}` : ''}
        onChange={(e) => {
          const agent = agents.find(
            (a) => `${a.gatewayId}:${a.agentId}` === e.target.value
          )
          if (agent) onSelect(agent)
        }}
        disabled={loading || agents.length === 0}
        className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'rgb(var(--bg-tertiary))',
          color: 'rgb(var(--text-primary))',
          borderColor: 'rgb(var(--border-color))',
        }}
      >
        <option value="">
          {loading
            ? 'Loading agents...'
            : error
            ? `Error: ${error}`
            : agents.length === 0
            ? 'No agents available - check browser console for details'
            : 'Choose an agent...'}
        </option>
        {agents.map((agent) => (
          <option
            key={`${agent.gatewayId}:${agent.agentId}`}
            value={`${agent.gatewayId}:${agent.agentId}`}
          >
            {agent.capabilities?.imageRecognition ? '🖼️ ' : ''}{agent.gatewayName}: {agent.agentName}
          </option>
        ))}
      </select>
      {selectedAgent && (
        <div
          className="mt-2 text-sm"
          style={{ color: 'rgb(var(--text-secondary))' }}
        >
          💬 Chatting with <span className="font-medium">{selectedAgent.agentName}</span>{' '}
          {selectedAgent.capabilities?.imageRecognition ? <span title="Image recognition enabled">🖼️</span> : null} on{' '}
          {selectedAgent.gatewayName}
        </div>
      )}
      {error && !loading && (
        <div
          className="mt-2 text-sm p-2 rounded"
          style={{
            color: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          ⚠️ {error}
          <div className="mt-1 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
            Check the browser console (F12) for detailed error logs
          </div>
        </div>
      )}
      {!loading && !error && agents.length === 0 && (
        <div
          className="mt-2 text-sm p-3 rounded"
          style={{
            color: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)'
          }}
        >
          <div className="font-medium mb-2">
            {isConnected ? '🔍 No agents found on gateway' : '⚠️ No agents available'}
          </div>
          <div className="text-xs mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            {isConnected
              ? 'The gateway is connected but no agents are available. The gateway may not have any agents configured.'
              : 'You need to connect an OpenClaw Gateway first.'}
          </div>
          {!isConnected && (
            <a
              href="/gateways/setup"
              className="inline-block px-3 py-1.5 text-xs font-medium rounded"
              style={{
                backgroundColor: '#f59e0b',
                color: 'white',
              }}
            >
              → Connect Gateway
            </a>
          )}
          {isConnected && (
            <button
              onClick={() => window.location.reload()}
              className="inline-block px-3 py-1.5 text-xs font-medium rounded"
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
              }}
            >
              ↻ Refresh Page
            </button>
          )}
        </div>
      )}
    </div>
  )
}
