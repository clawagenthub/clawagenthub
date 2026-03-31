'use client'

import React, { ReactNode } from 'react'
import { ModalCapsulerWithHeader, type ModalSize } from './modal-capsuler'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  dismissible?: boolean
  size?: ModalSize
}

export function Modal({ isOpen, onClose, title, children, dismissible = true, size = 'md' }: ModalProps) {
  return (
    <ModalCapsulerWithHeader
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      dismissible={dismissible}
      showCloseButton={dismissible}
      showBackdrop={true}
      backdropBlur={true}
    >
      {children}
    </ModalCapsulerWithHeader>
  )
}
