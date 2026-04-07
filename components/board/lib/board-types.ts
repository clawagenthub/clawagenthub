import type { TicketWithRelations } from '@/lib/query/hooks'

/**
 * Flow badge configuration for visual styling
 */
export const FLOW_BADGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  flowing: {
    label: 'Flowing',
    bg: 'rgba(16, 185, 129, 0.18)',
    text: 'rgb(5, 150, 105)',
  },
  failed: {
    label: 'Failed',
    bg: 'rgba(239, 68, 68, 0.18)',
    text: 'rgb(220, 38, 38)',
  },
  waiting: {
    label: 'Waiting',
    bg: 'rgba(245, 158, 11, 0.18)',
    text: 'rgb(217, 119, 6)',
  },
  stopped: {
    label: 'Stopped',
    bg: 'rgba(107, 114, 128, 0.18)',
    text: 'rgb(75, 85, 99)',
  },
  completed: {
    label: 'Completed',
    bg: 'rgba(59, 130, 246, 0.18)',
    text: 'rgb(37, 99, 235)',
  },
  waiting_to_flow: {
    label: 'Waiting To Flow',
    bg: 'rgba(139, 92, 246, 0.18)',
    text: 'rgb(124, 58, 237)',
  },
}

export interface TicketCardProps {
  ticket: TicketWithRelations
  isSelected: boolean
  isDragging: boolean
  onSelect?: (ticketId: string, selected: boolean) => void
  onDoubleClick?: (ticket: TicketWithRelations) => void
  onDragStart?: (ticketId: string) => void
}

export interface ColumnHeaderProps {
  title: string
  color: string
  activeTicketsForSelection: TicketWithRelations[]
  draftCount: number
  selectedCount: number
  isAllSelected: boolean
  isSomeSelected: boolean
  eligibleForFlowStart: TicketWithRelations[]
  eligibleForFlowStop: TicketWithRelations[]
  allFlowingTickets: TicketWithRelations[]
  showStopAll: boolean
  isBulkStartingFlow: boolean
  isBulkStoppingFlow: boolean
  onSelectAll: (selected: boolean) => void
  onStartAllClick: () => void
  onStopAllClick: () => void
}

export interface StartAllConfirmProps {
  count: number
  onConfirm: () => void
  onCancel: () => void
}

export interface StopAllConfirmProps {
  count: number
  onConfirm: () => void
  onCancel: () => void
}
