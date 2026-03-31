import React from 'react'

interface TypingIndicatorProps {
  agentName?: string
  message?: string
  variant?: 'dots' | 'pulse' | 'wave'
}

export function TypingIndicator({ 
  agentName = 'AI', 
  message = 'is working',
  variant = 'dots' 
}: TypingIndicatorProps) {
  return (
    <div className="px-6 py-4 flex items-center gap-3">
      {/* Agent Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
        {agentName.charAt(0).toUpperCase()}
      </div>

      {/* Typing Animation */}
      <div className="flex items-center gap-2">
        {variant === 'dots' && (
          <>
            <div className="flex gap-1">
              <span 
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
                style={{ animationDelay: '0ms' }}
              />
              <span 
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
                style={{ animationDelay: '150ms' }}
              />
              <span 
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" 
                style={{ animationDelay: '300ms' }}
              />
            </div>
            <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
              {agentName} {message}
            </span>
          </>
        )}

        {variant === 'pulse' && (
          <>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
            <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
              {agentName} {message}
            </span>
          </>
        )}

        {variant === 'wave' && (
          <div className="flex items-center gap-2">
            <span 
              className="w-1 h-4 bg-blue-500 rounded animate-pulse" 
              style={{ animationDelay: '0ms', animationDuration: '0.8s' }}
            />
            <span 
              className="w-1 h-6 bg-blue-500 rounded animate-pulse" 
              style={{ animationDelay: '0.1s', animationDuration: '0.8s' }}
            />
            <span 
              className="w-1 h-4 bg-blue-500 rounded animate-pulse" 
              style={{ animationDelay: '0.2s', animationDuration: '0.8s' }}
            />
            <span 
              className="w-1 h-3 bg-blue-500 rounded animate-pulse" 
              style={{ animationDelay: '0.3s', animationDuration: '0.8s' }}
            />
            <span className="text-sm ml-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              {agentName} {message}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
