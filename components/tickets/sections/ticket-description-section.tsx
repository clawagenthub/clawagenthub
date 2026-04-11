'use client'

import React from 'react'
import {
  TextAreaWithImage,
  type ComposerAttachment,
} from '@/components/ui/text-area-with-image'
import { MarkdownEditor } from '../markdown-editor'

interface TicketDescriptionSectionProps {
  description: string
  onDescriptionChange: (value: string) => void
  attachments: ComposerAttachment[]
  onAttachmentsChange: (attachments: ComposerAttachment[]) => void
  showPreview: boolean
  onShowPreviewChange: (value: boolean) => void
  maxImagesPerPost: number
  allowPdfAttachments: boolean
  disabled: boolean
}

export function TicketDescriptionSection({
  description,
  onDescriptionChange,
  attachments,
  onAttachmentsChange,
  showPreview,
  onShowPreviewChange,
  maxImagesPerPost,
  allowPdfAttachments,
  disabled,
}: TicketDescriptionSectionProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label
          className="block text-sm font-medium"
          style={{ color: `rgb(var(--text-secondary))` }}
        >
          Description
        </label>
        <button
          type="button"
          onClick={() => onShowPreviewChange(!showPreview)}
          className="rounded px-2 py-1 text-xs transition-colors"
          style={{
            backgroundColor: `rgb(var(--bg-secondary))`,
            color: `rgb(var(--text-secondary))`,
            border: '1px solid rgb(var(--border-color))',
          }}
        >
          {showPreview ? 'Edit Raw' : 'Preview'}
        </button>
      </div>

      <div className="space-y-3">
        {showPreview ? (
          <div
            className="min-h-[120px] whitespace-pre-wrap rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: `rgb(var(--border-color))`,
              backgroundColor: `rgb(var(--bg-secondary))`,
              color: `rgb(var(--text-primary))`,
            }}
          >
            {description || (
              <span style={{ color: `rgb(var(--text-tertiary))` }}>
                No description
              </span>
            )}
          </div>
        ) : (
          <>
            <TextAreaWithImage
              value={description}
              onChange={onDescriptionChange}
              attachments={attachments}
              onAttachmentsChange={onAttachmentsChange}
              placeholder="Describe the ticket in Markdown..."
              disabled={disabled}
              minHeight={120}
              maxHeight={260}
              maxImages={maxImagesPerPost}
              maxFiles={maxImagesPerPost}
              allowPdf={allowPdfAttachments}
            />
            <MarkdownEditor
              value={description}
              onChange={onDescriptionChange}
              placeholder="Describe the ticket in Markdown..."
              height={200}
              readOnly={disabled}
            />
          </>
        )}
      </div>
    </div>
  )
}
