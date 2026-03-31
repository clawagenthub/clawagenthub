'use client'

import React, { useState, useMemo } from 'react'
import { marked } from 'marked'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: number
  hideToolbar?: boolean
  readOnly?: boolean
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your description in Markdown...',
  height = 300,
  hideToolbar = false,
  readOnly = false,
}: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false)

  // Configure marked for safe rendering
  useMemo(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    })
  }, [])

  const previewHtml = useMemo(() => {
    try {
      return marked(value || '')
    } catch {
      return '<p class="text-red-500">Invalid markdown</p>'
    }
  }, [value])

  return (
    <div className="flex flex-col" style={{ height: height + 'px' }}>
      {/* Toolbar */}
      {!hideToolbar && (
        <div 
          className="flex items-center gap-2 px-3 py-2 border-b rounded-t-lg"
          style={{
            backgroundColor: `rgb(var(--bg-tertiary))`,
            borderColor: `rgb(var(--border-color))`,
          }}
        >
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: isPreview ? `rgb(var(--accent-primary, 59 130 246))` : 'transparent',
              color: isPreview ? 'white' : `rgb(var(--text-secondary))`,
            }}
          >
            {isPreview ? '✏️ Edit' : '👁️ Preview'}
          </button>
          <div className="flex-1" />
          <span style={{ color: `rgb(var(--text-tertiary))`, fontSize: '12px' }}>
            Markdown supported
          </span>
        </div>
      )}

      {/* Editor/Preview */}
      <div 
        className="flex-1 flex overflow-hidden rounded-b-lg" 
        style={{ border: '1px solid rgb(var(--border-color))' }}
      >
        {isPreview ? (
          // Preview mode
          <div 
            className="flex-1 p-4 prose prose-invert max-w-none overflow-y-auto"
            style={{ 
              backgroundColor: `rgb(var(--bg-secondary))`,
              color: `rgb(var(--text-primary))`,
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          // Edit mode
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={readOnly}
            className="flex-1 w-full p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed"
            style={{
              backgroundColor: `rgb(var(--bg-secondary))`,
              color: `rgb(var(--text-primary))`,
            }}
          />
        )}
      </div>

      {/* Markdown hint */}
      <div className="mt-1 text-xs" style={{ color: `rgb(var(--text-tertiary))` }}>
        **bold** *italic* `code` [link](url) - headings with # ## ###
      </div>
    </div>
  )
}
