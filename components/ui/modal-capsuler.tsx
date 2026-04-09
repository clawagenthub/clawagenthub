'use client'

import React, { useEffect } from 'react'
import { ModalCapsulerProps, ModalCapsulerWithHeaderProps, ModalSize } from '@/lib/types/modal-types'

const sizeStyles: Record<ModalSize, { width: string; height: string; maxHeight: string }> = {
  xl: { width: '80%', height: '80%', maxHeight: '80vh' },
  lg: { width: '75%', height: 'auto', maxHeight: '85vh' },
  md: { width: '600px', height: 'auto', maxHeight: '85vh' },
  sm: { width: '450px', height: 'auto', maxHeight: '85vh' },
  xs: { width: '350px', height: 'auto', maxHeight: '85vh' },
}

export function ModalCapsuler({
  isOpen,
  onClose,
  size = 'md',
  children,
  dismissible = true,
  className = '',
  showBackdrop = true,
  backdropBlur = true,
}: ModalCapsulerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose, dismissible])

  if (!isOpen) return null

  const handleBackdropClick = () => {
    if (dismissible) onClose()
  }

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const currentSize = sizeStyles[size]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      {showBackdrop && (
        <div
          className={`absolute inset-0 transition-opacity ${
            backdropBlur 
              ? 'backdrop-blur-sm bg-opacity-30' 
              : ''
          }`}
          style={{
            backgroundColor: backdropBlur 
              ? 'rgba(var(--accent-primary, 59 130 246), 0.15)' 
              : 'rgba(0, 0, 0, 0.5)',
          }}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Modal Content */}
      <div
        onClick={handleContentClick}
        className={`
          relative z-10 rounded-lg shadow-xl overflow-auto
          transition-all duration-200 ease-in-out
          ${className}
        `}
        style={{
          width: currentSize.width,
          height: currentSize.height,
          maxHeight: currentSize.maxHeight,
          backgroundColor: `rgb(var(--bg-primary))`,
          borderColor: `rgb(var(--border-color))`,
          border: '1px solid',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalCapsulerWithHeader({
  isOpen,
  onClose,
  size = 'md',
  title,
  subtitle,
  children,
  dismissible = true,
  showCloseButton = true,
  className = '',
  showBackdrop = true,
  backdropBlur = true,
  headerClassName = '',
  contentClassName = '',
}: ModalCapsulerWithHeaderProps) {
  return (
    <ModalCapsuler
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      dismissible={dismissible}
      showBackdrop={showBackdrop}
      backdropBlur={backdropBlur}
      className={className}
    >
      {/* Header */}
      <div className={`flex items-start justify-between p-6 border-b ${headerClassName}`} style={{ borderColor: `rgb(var(--border-color))` }}>
        <div className="flex-1">
          <h2 className="text-xl font-semibold" style={{ color: `rgb(var(--text-primary))` }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm mt-1" style={{ color: `rgb(var(--text-secondary))` }}>
              {subtitle}
            </p>
          )}
        </div>
        {showCloseButton && dismissible && (
          <button
            type="button"
            onClick={onClose}
            className="ml-4 transition-colors rounded-lg p-1"
            style={{ color: `rgb(var(--text-tertiary))` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`
              e.currentTarget.style.color = `rgb(var(--text-primary))`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = `rgb(var(--text-tertiary))`
            }}
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className={`p-6 ${contentClassName}`}>
        {children}
      </div>
    </ModalCapsuler>
  )
}

