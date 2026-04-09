'use client'

import React from 'react'
import type { ComposerAttachment } from './text-area-with-image'

interface AttachmentPreviewProps {
  attachment: ComposerAttachment
  onRemove: (attachmentId: string) => void
}

export function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  return (
    <div
      className="relative w-24 rounded-lg border overflow-hidden"
      style={{
        backgroundColor: 'rgb(var(--bg-primary))',
        borderColor: 'rgb(var(--border-color))',
      }}
    >
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="absolute right-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-xs"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)', color: 'white' }}
        title={`Remove ${attachment.name}`}
      >
        ✕
      </button>

      {attachment.kind === 'image' && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="h-20 w-full object-cover"
        />
      ) : (
        <div
          className="h-20 w-full flex items-center justify-center text-2xl"
          style={{ color: 'rgb(var(--text-secondary))' }}
        >
          {attachment.kind === 'pdf' ? '📄' : '📎'}
        </div>
      )}

      <div className="p-2">
        <div className="truncate text-xs font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
          {attachment.name}
        </div>
        <div className="text-[11px]" style={{ color: 'rgb(var(--text-secondary))' }}>
          {Math.max(1, Math.round(attachment.size / 1024))} KB
        </div>
      </div>
    </div>
  )
}