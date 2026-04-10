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
  dataBase64?: string
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

async function toBase64(file: File) {
  const buffer = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
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

// --- Sub-components ---

interface AttachButtonProps {
  disabled: boolean
  onClick: () => void
}

function AttachButton({ disabled, onClick }: AttachButtonProps) {
  return (
    <button type="button" className="p-3 rounded-lg transition-all hover:scale-105 flex-shrink-0" style={{
      backgroundColor: 'rgb(var(--bg-tertiary, var(--bg-secondary)))',
      color: disabled ? 'rgb(var(--text-secondary), 0.5)' : 'rgb(var(--text-secondary))',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }} disabled={disabled} title="Attach images or PDFs" onClick={onClick}>📎</button>
  )
}

interface TextAreaInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onFocus: () => void
  onBlur: () => void
  disabled: boolean
  placeholder?: string
  textareaClassName?: string
  maxHeight: number
  minHeight: number
}

function TextAreaInput({ value, onChange, onKeyDown, onPaste, onFocus, onBlur, disabled, placeholder, textareaClassName, maxHeight, minHeight }: TextAreaInputProps) {
  return (
    <div className="flex-1 relative">
      <textarea value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} onFocus={onFocus} onBlur={onBlur}
        disabled={disabled} placeholder={placeholder}
        className={`w-full px-1 py-2 rounded-lg resize-none transition-all bg-transparent focus:outline-none ${disabled ? 'opacity-50' : ''} ${textareaClassName || ''}`}
        style={{ color: 'rgb(var(--text-primary))', maxHeight: `${maxHeight}px`, minHeight: `${minHeight}px` }} rows={1}
      />
    </div>
  )
}

interface FileInputProps {
  accept: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

function FileInput({ accept, onChange, inputRef }: FileInputProps) {
  return <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={onChange} />
}

interface AttachmentItemProps {
  attachment: ComposerAttachment
  onRemove: (id: string) => void
}

function AttachmentItem({ attachment, onRemove }: AttachmentItemProps) {
  return (
    <div className="relative w-24 rounded-lg border overflow-hidden" style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-color))' }}>
      <button type="button" onClick={() => onRemove(attachment.id)} className="absolute right-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-xs" style={{ backgroundColor: 'rgba(0,0,0,0.65)', color: 'white' }} title={`Remove ${attachment.name}`}>✕</button>
      {attachment.kind === 'image' && attachment.previewUrl ? (
        <img src={attachment.previewUrl} alt={attachment.name} className="h-20 w-full object-cover" />
      ) : (
        <div className="h-20 w-full flex items-center justify-center text-2xl" style={{ color: 'rgb(var(--text-secondary))' }}>{attachment.kind === 'pdf' ? '📄' : '📎'}</div>
      )}
      <div className="p-2">
        <div className="truncate text-xs font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{attachment.name}</div>
        <div className="text-[11px]" style={{ color: 'rgb(var(--text-secondary))' }}>{Math.max(1, Math.round(attachment.size / 1024))} KB</div>
      </div>
    </div>
  )
}

interface AttachmentListProps {
  attachments: ComposerAttachment[]
  onRemove: (id: string) => void
}

function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  return (
    <div className="px-3 pb-3">
      <div className="flex flex-wrap gap-3">
        {attachments.map((attachment) => <AttachmentItem key={attachment.id} attachment={attachment} onRemove={onRemove} />)}
      </div>
    </div>
  )
}

interface HintsBarProps {
  allowPdf: boolean
  attachments: ComposerAttachment[]
  maxImages: number
  totalLimit: number | undefined
}

function HintsBar({ allowPdf, attachments, maxImages, totalLimit }: HintsBarProps) {
  const imageCount = attachments.filter((item) => item.kind === 'image').length
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'rgb(var(--text-secondary), 0.75)' }}>
      <div>Paste or drag images{allowPdf ? ' / PDFs' : ''} here.</div>
      <div>{imageCount}/{maxImages} images{typeof totalLimit === 'number' ? ` • ${attachments.length}/${totalLimit} files` : ''}</div>
    </div>
  )
}

interface ContainerProps {
  isFocused: boolean
  isDragging: boolean
  disabled: boolean
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  children: React.ReactNode
}

function Container({ isFocused, isDragging, onDragOver, onDragEnter, onDragLeave, onDrop, children }: ContainerProps) {
  return (
    <div className={`rounded-lg border transition-all ${isFocused ? 'ring-2 ring-blue-500/20' : ''} ${isDragging ? 'border-blue-500 bg-blue-500/5' : ''}`}
      style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: isDragging ? 'rgb(59 130 246)' : 'rgb(var(--border-color))' }}
      onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {children}
    </div>
  )
}

// --- Main Component ---

export function TextAreaWithImage({
  value, onChange, onAttachmentsChange, attachments = [], placeholder, disabled,
  minHeight = 48, maxHeight = 220, maxImages = 5, maxFiles,
  accept = DEFAULT_ACCEPT, allowPdf = true, showHints = true, onSubmit, className, textareaClassName,
}: TextAreaWithImageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string>('')

  const effectiveAccept = useMemo(() => allowPdf ? accept : accept.filter((item) => item !== 'application/pdf'), [accept, allowPdf])
  const totalLimit = maxFiles ?? maxImages

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`
  }, [value, minHeight, maxHeight])

  useEffect(() => {
    return () => { attachments.forEach((attachment) => { if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl) }) }
  }, [attachments])

  const updateAttachments = useCallback((next: ComposerAttachment[]) => { onAttachmentsChange?.(next) }, [onAttachmentsChange])

  const addFiles = useCallback(async (inputFiles: File[]) => {
    if (!inputFiles.length) return
    const next = [...attachments]
    let nextError = ''

    for (const file of inputFiles) {
      const kind = toKind(file)
      const isImage = kind === 'image'
      const isPdf = kind === 'pdf'

      if (!matchesAccept(file, effectiveAccept)) { nextError = `${file.name} is not an allowed file type.`; continue }
      if (!allowPdf && isPdf) { nextError = `${file.name} is not allowed here.`; continue }
      if (isImage && next.filter((item) => item.kind === 'image').length >= maxImages) { nextError = `You can attach up to ${maxImages} image${maxImages === 1 ? '' : 's'}.`; continue }
      if (next.length >= totalLimit) { nextError = `You can attach up to ${totalLimit} file${totalLimit === 1 ? '' : 's'} here.`; continue }

      next.push({ id: buildAttachmentId(file), file, kind, name: file.name, size: file.size, mimeType: file.type, previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined, dataBase64: await toBase64(file) })
    }

    setError(nextError)
    updateAttachments(next)
  }, [attachments, effectiveAccept, allowPdf, maxImages, totalLimit, updateAttachments])

  const removeAttachment = useCallback((attachmentId: string) => {
    const target = attachments.find((item) => item.id === attachmentId)
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    updateAttachments(attachments.filter((item) => item.id !== attachmentId))
  }, [attachments, updateAttachments])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && onSubmit) { e.preventDefault(); onSubmit() } }, [onSubmit])
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => { if (disabled) return; const files = extractFiles(e.clipboardData?.items); if (!files.length) return; e.preventDefault(); addFiles(files) }, [addFiles, disabled])
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); if (disabled) return; addFiles(Array.from(e.dataTransfer.files || [])) }, [addFiles, disabled])
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (!disabled) setIsDragging(true) }, [disabled])
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (!disabled) setIsDragging(true) }, [disabled])
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); const related = e.relatedTarget as Node | null; if (!related || !e.currentTarget.contains(related)) setIsDragging(false) }, [])
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { addFiles(Array.from(e.target.files || [])); e.target.value = '' }, [addFiles])

  return (
    <div className={className}>
      <Container isFocused={isFocused} isDragging={isDragging} disabled={disabled} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <div className="flex items-end gap-3 p-3">
          <AttachButton disabled={disabled} onClick={() => fileInputRef.current?.click()} />
          <TextAreaInput value={value} onChange={onChange} onKeyDown={handleKeyDown} onPaste={handlePaste} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
            disabled={disabled} placeholder={placeholder || 'Type your message...'} textareaClassName={textareaClassName} maxHeight={maxHeight} minHeight={minHeight} />
        </div>
        <FileInput accept={effectiveAccept.join(',')} onChange={handleFileInputChange} inputRef={fileInputRef} />
        {attachments.length > 0 && <AttachmentList attachments={attachments} onRemove={removeAttachment} />}
      </Container>
      {showHints && <HintsBar allowPdf={allowPdf} attachments={attachments} maxImages={maxImages} totalLimit={totalLimit} />}
      {error && <div className="mt-2 text-xs" style={{ color: 'rgb(239 68 68)' }}>{error}</div>}
    </div>
  )
}

export type { ComposerAttachment, AttachmentKind }