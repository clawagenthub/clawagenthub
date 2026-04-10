'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useUpdateSessionTitle, useGenerateSessionTitle, useGenerateSessionSummary } from '@/lib/query/hooks/useChat'
import logger, { logCategories as _logCategories } from '@/lib/logger/index.js'


interface UseChatHeaderProps {
  session: {
    id: string
    title?: string | null
    description?: string | null
  }
}

export function useChatHeader({ session }: UseChatHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(session.title || 'New Chat')
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState(session.description || '')
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)

  const [summaryError, setSummaryError] = useState<string | null>(null)

  const updateTitle = useUpdateSessionTitle()
  const generateTitle = useGenerateSessionTitle()
  const generateSummary = useGenerateSessionSummary()

  const descriptionText = (session.description || '').trim()
  const descriptionPreview = descriptionText.length > 50
    ? `${descriptionText.slice(0, 50)}...`
    : descriptionText
  const hasLongDescription = descriptionText.length > 50

  // Update edited title when session title changes
  useEffect(() => {
    setEditedTitle(session.title || 'New Chat')
  }, [session.title])

  // Update edited description when session description changes
  useEffect(() => {
    setEditedDescription(session.description || '')
  }, [session.description])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  // Focus textarea when description editing starts
  useEffect(() => {
    if (isEditingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus()
      descriptionInputRef.current.select()
    }
  }, [isEditingDescription])

  // Title editing handlers
  const handleTitleClick = useCallback(() => {
    setIsEditingTitle(true)
  }, [])

  const handleTitleSave = useCallback(async () => {
    const trimmedTitle = editedTitle.trim()
    if (trimmedTitle && trimmedTitle !== session.title) {
      await updateTitle.mutateAsync({
        sessionId: session.id,
        title: trimmedTitle,
      })
    } else {
      setEditedTitle(session.title || 'New Chat')
    }
    setIsEditingTitle(false)
  }, [editedTitle, session.title, session.id, updateTitle])

  const handleTitleCancel = useCallback(() => {
    setEditedTitle(session.title || 'New Chat')
    setIsEditingTitle(false)
  }, [session.title])

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      handleTitleCancel()
    }
  }, [handleTitleSave, handleTitleCancel])

  const handleDescriptionClick = useCallback(() => {
    setIsEditingDescription(true)
  }, [])

  const handleDescriptionSave = useCallback(async () => {
    const trimmedDescription = editedDescription.trim()
    if (trimmedDescription !== session.description) {
      await updateTitle.mutateAsync({
        sessionId: session.id,
        description: trimmedDescription || undefined,
      })
    } else {
      setEditedDescription(session.description || '')
    }
    setIsEditingDescription(false)
  }, [editedDescription, session.description, session.id, updateTitle])

  const handleDescriptionCancel = useCallback(() => {
    setEditedDescription(session.description || '')
    setIsEditingDescription(false)
  }, [session.description])

  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleDescriptionSave()
    } else if (e.key === 'Escape') {
      handleDescriptionCancel()
    }
  }, [handleDescriptionSave, handleDescriptionCancel])

  const handleSummarize = useCallback(async () => {
    try {
      setSummaryError(null)
      logger.debug('[EnhancedChatScreen] Summarize clicked', { sessionId: session.id })
      const result = await generateSummary.mutateAsync(session.id)
      logger.debug('[EnhancedChatScreen] Summarize success', {
        sessionId: session.id,
        title: result?.title,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate summary'
      setSummaryError(message)
      logger.error('[EnhancedChatScreen] Summarize failed', {
        sessionId: session.id,
        error: message,
      })
    }
  }, [generateSummary, session.id])

  return {
    // Title state
    isEditingTitle,
    editedTitle,
    setEditedTitle,
    titleInputRef,
    handleTitleClick,
    handleTitleSave,
    handleTitleCancel,
    handleTitleKeyDown,
    // Description state
    isEditingDescription,
    editedDescription,
    setEditedDescription,
    descriptionInputRef,
    descriptionText,
    descriptionPreview,
    hasLongDescription,
    handleDescriptionClick,
    handleDescriptionSave,
    handleDescriptionCancel,
    handleDescriptionKeyDown,
    // Summary state
    summaryError,
    handleSummarize,
    // Mutations
    generateTitle,
    generateSummary,
  }
}
