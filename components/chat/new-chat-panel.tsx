'use client'

import { AgentSelector } from './agent-selector'
import { useCreateSession } from '@/lib/query/hooks/useChat'
import { useGatewayAgents, useGatewayConnection } from '@/lib/hooks/useGatewayService'
import logger, { logCategories as _logCategories } from '@/lib/logger/index.js'


export function NewChatPanel({ onStartChat }: { onStartChat: (sessionId: string) => void }) {
  // Use GatewayService hooks for agents and connection status
  const { agents, isLoadingAgents, refreshAgents } = useGatewayAgents()
  const { isConnected, isLoading, connectionError, tryReconnect } = useGatewayConnection()
  const createSession = useCreateSession()

  const handleAgentSelect = async (agent: any) => {
    try {
      const session = await createSession.mutateAsync({
        gatewayId: agent.gatewayId,
        agentId: agent.agentId,
        agentName: agent.agentName,
      })
      
      onStartChat(session.id)
    } catch (error) {
      logger.error('Failed to create session:', error)
    }
  }

  const handleReconnect = async () => {
    await tryReconnect()
  }

  const handleRefreshAgents = async () => {
    await refreshAgents()
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
      {/* Header */}
      <div className="px-8 py-6 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            Start a New Chat
          </h1>
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
              {isLoading ? 'Connecting...' : isConnected ? 'Gateway Connected' : 'Gateway Disconnected'}
            </span>
          </div>
        </div>
        <p style={{ color: 'rgb(var(--text-secondary))' }}>
          Select an agent to begin a conversation
        </p>
      </div>

      {/* Agent Selector */}
      <div className="flex-1 p-8 overflow-y-auto">
        {!isConnected && connectionError && (
          <div className="mb-6 p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">
                  Gateway Connection Error
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">{connectionError}</p>
              </div>
              <button
                onClick={handleReconnect}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reconnect
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Available Agents
          </h2>
          <button
            onClick={handleRefreshAgents}
            disabled={!isConnected || isLoadingAgents}
            className="px-3 py-1 text-sm rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))',
            }}
          >
            {isLoadingAgents ? 'Loading...' : 'Refresh Agents'}
          </button>
        </div>

        <AgentSelector
          agents={agents}
          selectedAgent={null}
          onSelect={handleAgentSelect}
          loading={isLoadingAgents || isLoading}
          error={connectionError || (!isConnected ? 'Gateway not connected' : undefined)}
          isConnected={isConnected}
        />
      </div>
    </div>
  )
}
