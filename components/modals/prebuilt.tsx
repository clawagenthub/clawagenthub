'use client'

// prebuilt.tsx - Prebuilt modal components for Fast Refresh compliance
import React from 'react'
import { ModalCapsuler } from '@/components/ui/modal-capsuler'
import { ModalCapsulerProps, ModalSize } from '@/lib/types/modal-types'

// Convenience function to create modal with specific size
function createModal(size: ModalSize) {
  return function ModalComponent(props: Omit<ModalCapsulerProps, 'size'>) {
    return <ModalCapsuler {...props} size={size} />
  }
}

// Pre-sized modal components
export const ModalXL = createModal('xl')
export const ModalLG = createModal('lg')
export const ModalMD = createModal('md')
export const ModalSM = createModal('sm')
export const ModalXS = createModal('xs')
