// modal-types.ts - Modal type definitions for Fast Refresh compliance
import { ReactNode } from 'react'

export type ModalSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs'

export interface ModalCapsulerProps {
  isOpen: boolean
  onClose: () => void
  size?: ModalSize
  children: ReactNode
  dismissible?: boolean
  className?: string
  showBackdrop?: boolean
  backdropBlur?: boolean
}

export interface ModalCapsulerWithHeaderProps extends Omit<ModalCapsulerProps, 'children'> {
  title: string
  subtitle?: string
  children: ReactNode
  showCloseButton?: boolean
  headerClassName?: string
  contentClassName?: string
}
