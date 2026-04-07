'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type AttachmentKind = 'image' | 'pdf' | 'file'

export interface ComposerAttachment {
  id: string
  file: File
  kind: AttachmentKind
  name: string
  size: number
  mimeType: string
  previewUrl?: string
}

interface TextAreaWithImageProps {
  value: string
  onChange: (value: string) => void
  onAttachmentsChange?: (attachments: ComposerAttachment[]) => void
  attachments?: ComposerAttachment[]
  placeholder?: string
  disabled?: boolean
  minHeight?: number
  maxHeight?: number
  maxImages?: number
  maxFiles?: number
  accept?: string[]
  allowPdf?: boolean
  showHints?: boolean
  onSubmit?: () => void
  className?: string
  textareaClassName?: string
}

const DEFAULT_ACCEPT = ['image/*', 'application/pdf']

function buildAttachmentId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`
}

function matchesAccept(file: File, accept: string[]) {
  if (!accept.length) return true
  return accept.some((pattern) => {
    if (pattern === file.type) return true
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1)
      return file.type.startsWith(prefix)
    }
    return false
  })
}

function toKind(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  return 'file'
}

function extractFiles(items: DataTransferItemList | null | undefined) {
  if (!items) return [] as File[]
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

export function TextAreaWithImage({
  value,
  onChange,
  onAttachmentsChange,
  attachments = [],
  placeholder,
  disabled,
  minHeight = 48,
  maxHeight = 220,
  maxImages = 5,
  maxFiles,
  accept = DEFAULT_ACCEPT,
  allowPdf = true,
  showHints = true,
  onSubmit,
  className,
  textareaClassName,
}: TextAreaWithImageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string>('')

  const effectiveAccept = useMemo(() => {
    if (allowPdf) return accept
    return accept.filter((item) => item !== 'application/pdf')
  }, [accept, allowPdf])

  const totalLimit = maxFiles ?? maxImages

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [value, minHeight, maxHeight])

  useEffect(() => {
    return () => {
      attachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      })
    }
  }, [])

  const updateAttachments = useCallback((next: ComposerAttachment[]) => {
    onAttachmentsChange?.(next)
  }, [onAttachmentsChange])

  const addFiles = useCallback((inputFiles: File[]) => {
    if (!inputFiles.length) return

    const next = [...attachments]
    let nextError = ''

    for (const file of inputFiles) {
      const kind = toKind(file)
      const isImage = kind === 'image'
      const isPdf = kind === 'pdf'

      if (!matchesAccept(file, effectiveAccept)) {
        nextError = `${file.name} is not an allowed file type.`
        continue
      }

      if (!allowPdf && isPdf) {
        nextError = `${file.name} is not allowed here.`
        continue
      }

      if (isImage) {
        const imageCount = next.filter((item) => item.kind === 'image').length
        if (imageCount >= maxImages) {
          nextError = `You can attach up to ${maxImages} image${maxImages === 1 ? '' : 's'}.`
          continue
        }
      }

      if (next.length >= totalLimit) {
        nextError = `You can attach up to ${totalLimit} file${totalLimit === 1 ? '' : 's'} here.`
        continue
      }

      next.push({
        id: buildAttachmentId(file),
        file,
        kind,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
      })
    }

    setError(nextError)
    if (next !== attachments) {
      updateAttachments(next)
    }
  }, [attachments, effectiveAccept, allowPdf, maxImages, totalLimit, updateAttachments])

  const removeAttachment = useCallback((attachmentId: string) => {
    const target = attachments.find((item) => item.id === attachmentId)
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl)
    }
    updateAttachments(attachments.filter((item) => item.id !== attachmentId))
  }, [attachments, updateAttachments])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }, [onSubmit])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return
    const files = extractFiles(e.clipboardData?.items)
    if (!files.length) return
    e.preventDefault()
    addFiles(files)
  }, [addFiles, disabled])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files || [])
    addFiles(files)
  }, [addFiles, disabled])

  return (
    <div className={className}>
      <div
        className={`rounded-lg border transition-all ${isFocused ? 'ring-2 ring-blue-500/20' : ''} ${isDragging ? 'border-blue-500 bg-blue-500/5' : ''}`}
        style={{
          backgroundColor: 'rgb(var(--bg-secondary))',
          borderColor: isDragging ? 'rgb(59 130 246)' : 'rgb(var(--border-color))',
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          const related = e.relatedTarget as Node | null
          if (!related || !e.currentTarget.contains(related)) {
            setIsDragging(false)
          }
        }}
        onDrop={handleDrop}
      >
        <div className="flex items-end gap-3 p-3">
          <button
            type="button"
            className="p-3 rounded-lg transition-all hover:scale-105 flex-shrink-0"
            style={{
              backgroundColor: 'rgb(var(--bg-tertiary, var(--bg-secondary)))',
              color: disabled ? 'rgb(var(--text-secondary), 0.5)' : 'rgb(var(--text-secondary))',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            disabled={disabled}
            title="Attach images or PDFs"
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              placeholder={placeholder || 'Type your message...'}
              className={`w-full px-1 py-2 rounded-lg resize-none transition-all bg-transparent focus:outline-none ${disabled ? 'opacity-50' : ''} ${textareaClassName || ''}`}
              style={{
                color: 'rgb(var(--text-primary))',
                maxHeight: `${maxHeight}px`,
                minHeight: `${minHeight}px`,
              }}
              rows={1}
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={effectiveAccept.join(',')}
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files || []))
            e.target.value = ''
          }}
        />

        {attachments.length > 0 && (
          <div className="px-3 pb-3">
            <div className="flex flex-wrap gap-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="relative w-24 rounded-lg border overflow-hidden"
                  style={{
                    backgroundColor: 'rgb(var(--bg-primary))',
                    borderColor: 'rgb(var(--border-color))',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
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
              ))}
            </div>
          </div>
        )}
      </div>

      {showHints && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'rgb(var(--text-secondary), 0.75)' }}>
          <div>
            Paste or drag images{allowPdf ? ' / PDFs' : ''} here.
          </div>
          <div>
            {attachments.filter((item) => item.kind === 'image').length}/{maxImages} images
            {typeof totalLimit === 'number' ? ` • ${attachments.length}/${totalLimit} files` : ''}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs" style={{ color: 'rgb(239 68 68)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
