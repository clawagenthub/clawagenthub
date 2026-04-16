/**
 * PostPreview Component
 * Markdown preview for LinkedIn post drafts
 * 
 * Features:
 * - Renders markdown content with proper LinkedIn formatting
 * - Supports headings, bold, italic, links, lists, code blocks
 * - Live preview as user types
 * - Toggle between raw markdown and rendered preview
 */

'use client'

import React, { useMemo } from 'react'

interface PostPreviewProps {
  content: string
  className?: string
  showRaw?: boolean
}

// Simple markdown parser for LinkedIn posts
function parseMarkdown(text: string): string {
  if (!text) return ''

  let html = text
    // Escape HTML to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ (not preceded by another *)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #0077b5; text-decoration: underline;">$1</a>')
    // Code blocks: ```code```
    .replace(/```([\s\S]+?)```/g, '<pre style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 14px;"><code>$1</code></pre>')
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 14px;">$1</code>')
    // Headers: # Header
    .replace(/^### (.+)$/gm, '<h3 style="font-size: 18px; font-weight: 600; margin: 16px 0 8px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size: 20px; font-weight: 600; margin: 20px 0 10px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size: 24px; font-weight: 700; margin: 24px 0 12px;">$1</h1>')
    // Unordered lists: - item
    .replace(/^- (.+)$/gm, '<li style="margin-left: 20px;">$1</li>')
    // Ordered lists: 1. item
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left: 20px; list-style-type: decimal;">$1</li>')
    // Hashtags: #hashtag (but not inside links)
    .replace(/(?<!href=")(^|\s)#([\w]+)/g, '$1<span style="color: #0077b5; font-weight: 500;">#$2</span>')
    // Clean up multiple <br> in lists
    .replace(/<br><li/g, '<li')

  // Wrap in paragraph if needed
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`
  }

  // Wrap consecutive list items in <ul>
  html = html.replace(/(<li[^>]*>[\s\S]*?<\/li>)(\s*<li[^>]*>[\s\S]*?<\/li>)+/g, '<ul style="margin: 12px 0; padding-left: 20px;">$&</ul>')

  return html
}

// LinkedIn-specific formatting
function formatForLinkedIn(text: string): { rendered: string; stats: { charCount: number; lineCount: number; hashtagCount: number } } {
  const charCount = text.length
  const lineCount = text.split('\n').length
  const hashtagCount = (text.match(/#\w+/g) || []).length

  return {
    rendered: parseMarkdown(text),
    stats: { charCount, lineCount, hashtagCount }
  }
}

export function PostPreview({ content, className = '', showRaw = false }: PostPreviewProps) {
  const { rendered, stats } = useMemo(() => formatForLinkedIn(content), [content])

  if (!content) {
    return (
      <div className={`p-6 rounded-lg border ${className}`} style={{ 
        backgroundColor: 'rgb(var(--bg-secondary))', 
        borderColor: 'rgb(var(--border-color))',
        color: 'rgb(var(--text-secondary))'
      }}>
        <p className="text-center italic">Start typing to see preview...</p>
      </div>
    )
  }

  if (showRaw) {
    return (
      <div className={`p-4 rounded-lg border font-mono text-sm ${className}`} style={{ 
        backgroundColor: 'rgb(var(--bg-secondary))', 
        borderColor: 'rgb(var(--border-color))',
        color: 'rgb(var(--text-primary))',
        whiteSpace: 'pre-wrap'
      }}>
        {content}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Stats bar */}
      <div className="flex gap-4 mb-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
        <span>{stats.charCount} chars</span>
        <span>{stats.lineCount} lines</span>
        <span>{stats.hashtagCount} hashtags</span>
      </div>

      {/* Preview container */}
      <div 
        className="p-6 rounded-lg border prose prose-sm max-w-none"
        style={{ 
          backgroundColor: 'rgb(var(--bg-secondary))', 
          borderColor: 'rgb(var(--border-color))',
          color: 'rgb(var(--text-primary))',
          lineHeight: 1.6
        }}
        dangerouslySetInnerHTML={{ __html: rendered }}
      />

      {/* LinkedIn compatibility warning */}
      {stats.charCount > 3000 && (
        <p className="mt-2 text-xs" style={{ color: 'rgb(239 68 68)' }}>
          ⚠️ Post exceeds LinkedIn's 3000 character limit
        </p>
      )}
    </div>
  )
}

// Standalone preview with editing support
interface LinkedInPreviewProps {
  content: string
  onContentChange?: (content: string) => void
  editable?: boolean
  className?: string
}

export function LinkedInPreview({ content, onContentChange, editable = false, className = '' }: LinkedInPreviewProps) {
  return (
    <div className={className}>
      {editable ? (
        <textarea
          value={content}
          onChange={(e) => onContentChange?.(e.target.value)}
          className="w-full p-4 rounded-lg border font-mono text-sm"
          style={{ 
            backgroundColor: 'rgb(var(--bg-secondary))', 
            borderColor: 'rgb(var(--border-color))',
            color: 'rgb(var(--text-primary))'
          }}
          rows={10}
          placeholder="Write your LinkedIn post..."
        />
      ) : null}
      <PostPreview content={content} className="mt-4" />
    </div>
  )
}

export default PostPreview