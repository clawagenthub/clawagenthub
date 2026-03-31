'use client'

import React, { useState } from 'react'
import { AgentSelector } from './agent-selector'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { useAgents, useCreateSession, useChatMessages, useSendMessage } from '@/lib/query/hooks/useChat'
import type { AgentInfo } from '@/lib/db/schema'

export function ChatPanel() {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // Fetch agents and messages
  const { data: agents = [], isLoading: agentsLoading, error: agentsError } = useAgents()
  const { data: messages = [], isLoading: messagesLoading } = useChatMessages(currentSessionId)

  // Mutations
  const createSession = useCreateSession()
  const sendMessage = useSendMessage()

  const handleAgentSelect = async (agent: AgentInfo) => {
    setSelectedAgent(agent)

    // Create a new chat session for this agent
    try {
      const session = await createSession.mutateAsync({
        gatewayId: agent.gatewayId,
        agentId: agent.agentId,
        agentName: agent.agentName,
      })
      setCurrentSessionId(session.id)
    } catch (error) {
      console.error('Failed to create session:', error)
      alert('Failed to start chat session')
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!currentSessionId) return

    try {
      await sendMessage.mutateAsync({
        sessionId: currentSessionId,
        content,
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message')
    }
  }

  return (
    <aside
      className="w-80 border-l flex flex-col"
      style={{
        backgroundColor: 'rgb(var(--sidebar-bg))',
        borderColor: 'rgb(var(--border-color))',
      }}
    >
      {/* Header */}
      <div
        className="p-4 border-b"
        style={{ borderColor: 'rgb(var(--border-color))' }}
      >
        <h2
          className="text-lg font-semibold"
          style={{ color: 'rgb(var(--text-primary))' }}
        >
          💬 Agent Chat
        </h2>
      </div>

      {/* Agent Selector */}
      <AgentSelector
        agents={agents}
        selectedAgent={selectedAgent}
        onSelect={handleAgentSelect}
        loading={agentsLoading}
        error={agentsError ? String(agentsError) : undefined}
      />

      {/* Messages Area */}
      {selectedAgent && currentSessionId ? (
        <>
          <ChatMessages messages={messages} loading={messagesLoading} />
          <ChatInput
            onSend={handleSendMessage}
            disabled={sendMessage.isPending}
            placeholder={`Message ${selectedAgent.agentName}...`}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center" style={{ color: 'rgb(var(--text-secondary))' }}>
            <div className="text-4xl mb-4">🤖</div>
            <p className="text-sm">Select an agent to start chatting</p>
          </div>
        </div>
      )}
    </aside>
  )
}
