import React, { useEffect, useRef } from 'react'

interface StreamingMessageProps {
  content: string
  isStreaming?: boolean
  agentName?: string
  error?: string
}

export function StreamingMessage({ content, isStreaming = false, agentName = 'AI', error }: StreamingMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const prevContentRef = useRef('')

  // Auto-scroll to keep cursor in view during streaming
  useEffect(() => {
    if (isStreaming && contentRef.current && content !== prevContentRef.current) {
      // Scroll into view smoothly if needed
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    prevContentRef.current = content
  }, [content, isStreaming])

  const extractTextFromContent = (contentStr: string): string => {
    try {
      const parsed = JSON.parse(contentStr)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n')
      }
      if (parsed.content) {
        return extractTextFromContent(parsed.content)
      }
      return contentStr
    } catch {
      return contentStr
    }
  }

  const displayText = extractTextFromContent(content)

  return (
    <div ref={containerRef} className="px-6 py-4 flex items-start gap-3">
      {/* Agent Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
        {agentName.charAt(0).toUpperCase()}
      </div>

      {/* Message Bubble */}
      <div className="flex-1 min-w-0">
        <div
          className={`inline-block max-w-full rounded-2xl rounded-tl-sm px-4 py-3 ${
            error ? 'border border-red-300 dark:border-red-700' : ''
          }`}
          style={{
            backgroundColor: error ? 'rgb(254 226 226)' : 'rgb(var(--bg-secondary))',
            border: error ? undefined : '1px solid rgb(var(--border-color))'
          }}
        >
          {error ? (
            <div className="text-red-600 dark:text-red-400">
              <span className="font-medium">Error:</span> {error}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div 
                ref={contentRef}
                className="whitespace-pre-wrap break-words"
              >
                {displayText || <span className="text-gray-400 italic">Thinking...</span>}
              </div>

              {/* Streaming Cursor */}
              {isStreaming && displayText && (
                <span className="inline-block w-0.5 h-5 bg-blue-500 ml-1 align-middle animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Timestamp when complete */}
        {!isStreaming && !error && (
          <div className="mt-1 text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
            Just now
          </div>
        )}
      </div>
    </div>
  )
}
