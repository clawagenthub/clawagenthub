'use client'

import {
  TicketModalContent,
  type TicketModalProps,
} from './ticket-modal-content'
import logger, { logCategories } from '@/lib/logger/index.js'

export function TicketModal(props: TicketModalProps) {
  logger.debug(
    { category: logCategories.CHAT },
    '[TicketModal][split-validation] wrapper rendered: isOpen=%s isSubmitting=%s hasInitialData=%s',
    props.isOpen,
    props.isSubmitting ?? false,
    Boolean(props.initialData)
  )

  return <TicketModalContent {...props} />
}
