/**
 * PromptCanvas Component
 * Provider selection UI for AI prompt generation
 * 
 * Features:
 * - Select AI provider (OpenAI, Anthropic, Google, Local)
 * - Model selection per provider
 * - Prompt input and history
 * - Provider status indicators
 */

'use client'

import React, { useState, useCallback } from 'react'
import { useOnMount } from '@/lib/hooks/use-lifecycle'
import { Button } from '@/components/ui/button'

// Provider types
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'local'

export interface ProviderConfig {
  id: AIProvider
  name: string
  icon: string
  models: string[]
  status: 'active' | 'inactive' | 'error'
  description?: string
}

// Default provider configurations
const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🧠',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    status: 'active',
    description: 'OpenAI GPT-4 models'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧬',
    models: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
    status: 'active',
    description: 'Anthropic Claude models'
  },
  {
    id: 'google',
    name: 'Google',
    icon: '🔴',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    status: 'active',
    description: 'Google Gemini models'
  },
  {
    id: 'local',
    name: 'Local (Ollama)',
    icon: '💻',
    models: ['llama3', 'mistral', 'codellama', 'phi3'],
    status: 'inactive',
    description: 'Local Ollama models'
  }
]

interface PromptCanvasProps {
  onPromptSubmit?: (provider: AIProvider, model: string, prompt: string) => void
  onProviderChange?: (provider: AIProvider) => void
  isGenerating?: boolean
  className?: string
}

export function PromptCanvas({
  onPromptSubmit,
  onProviderChange,
  isGenerating = false,
  className = '',
}: PromptCanvasProps) {
  // State
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [prompt, setPrompt] = useState<string>('')
  const [providers] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS)

  // Lifecycle: Initialize
  useOnMount(() => {
    // Set default model
    const defaultProvider = providers.find(p => p.id === selectedProvider)
    if (defaultProvider && defaultProvider.models.length > 0) {
      setSelectedModel(defaultProvider.models[0])
    }
  })

  // Handle provider change
  const handleProviderChange = useCallback((providerId: AIProvider) => {
    setSelectedProvider(providerId)
    const provider = providers.find(p => p.id === providerId)
    if (provider && provider.models.length > 0) {
      setSelectedModel(provider.models[0])
    }
    onProviderChange?.(providerId)
  }, [providers, onProviderChange])

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!prompt.trim()) return
    onPromptSubmit?.(selectedProvider, selectedModel, prompt)
  }, [selectedProvider, selectedModel, prompt, onPromptSubmit])

  // Get current provider
  const currentProvider = providers.find(p => p.id === selectedProvider)

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
          AI Provider
        </label>
        <div className="flex gap-2 flex-wrap">
          {providers.map(provider => (
            <button
              key={provider.id}
              onClick={() => handleProviderChange(provider.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                selectedProvider === provider.id 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : ''
              }`}
              style={{ 
                backgroundColor: 'rgb(var(--bg-secondary))',
                borderColor: selectedProvider === provider.id 
                  ? 'rgb(59 130 246)' 
                  : 'rgb(var(--border-color))',
                color: 'rgb(var(--text-primary))',
                opacity: provider.status === 'inactive' ? 0.5 : 1
              }}
              disabled={provider.status === 'inactive'}
              title={provider.description}
            >
              <span className="text-xl">{provider.icon}</span>
              <div className="text-left">
                <div className="font-medium">{provider.name}</div>
                <div className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                  {provider.models.length} models
                </div>
              </div>
              {provider.status === 'active' && (
                <span className="ml-2 w-2 h-2 rounded-full bg-green-500" title="Active" />
              )}
              {provider.status === 'inactive' && (
                <span className="ml-2 w-2 h-2 rounded-full bg-gray-400" title="Inactive" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      {currentProvider && currentProvider.models.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
            Model
          </label>
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            style={{ 
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-color))',
              color: 'rgb(var(--text-primary))'
            }}
          >
            {currentProvider.models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      )}

      {/* Prompt Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
          rows={6}
          className="w-full px-3 py-2 rounded-lg border resize-none"
          style={{ 
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))'
          }}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => setPrompt('')}
          disabled={!prompt.trim()}
        >
          Clear
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={isGenerating}
          disabled={!prompt.trim()}
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </Button>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-4 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
        <span>
          Provider: <strong>{currentProvider?.name}</strong>
        </span>
        <span>
          Model: <strong>{selectedModel}</strong>
        </span>
        <span>
          {prompt.length} chars
        </span>
      </div>
    </div>
  )
}

// Provider status badge component
export function ProviderStatusBadge({ status }: { status: ProviderConfig['status'] }) {
  const colors = {
    active: 'bg-green-500',
    inactive: 'bg-gray-400',
    error: 'bg-red-500'
  }
  const labels = {
    active: 'Active',
    inactive: 'Inactive',
    error: 'Error'
  }
  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${colors[status]}`}
      style={{ color: 'white' }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      {labels[status]}
    </span>
  )
}

export type { ProviderConfig }
export default PromptCanvas