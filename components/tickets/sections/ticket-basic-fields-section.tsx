'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { AutocompleteInput } from '@/components/ui/autocomplete-input'
import logger, { logCategories } from '@/lib/logger/index.js'

interface Option {
  value: string
  label: string
}

interface TicketBasicFieldsSectionProps {
  projectOptions: Option[]
  projectId: string
  onProjectChange: (value: string) => void
  assigneeOptions: Option[]
  assignedTo: string
  onAssignedToChange: (value: string) => void
  title: string
  onTitleChange: (value: string) => void
  statusOptions: Option[]
  statusId: string
  onStatusChange: (value: string) => void
  flowEnabled: boolean
  onFlowEnabledChange: (value: boolean) => void
  isDraft: boolean
  isEditing: boolean
  isSubTicket: boolean
  onSubTicketChange: (value: boolean) => void
  parentTicketId: string
  onParentTicketIdChange: (value: string) => void
  waitingFinishedTicketId: string
  onWaitingFinishedTicketIdChange: (value: string) => void
  editingTicketId: string | null
  disabled: boolean
}

export function TicketBasicFieldsSection({
  projectOptions,
  projectId,
  onProjectChange,
  assigneeOptions,
  assignedTo,
  onAssignedToChange,
  title,
  onTitleChange,
  statusOptions,
  statusId,
  onStatusChange,
  flowEnabled,
  onFlowEnabledChange,
  isDraft,
  isEditing,
  isSubTicket,
  onSubTicketChange,
  parentTicketId,
  onParentTicketIdChange,
  waitingFinishedTicketId,
  onWaitingFinishedTicketIdChange,
  editingTicketId,
  disabled,
}: TicketBasicFieldsSectionProps) {
  return (
    <>
      <Select
        label="Project"
        options={projectOptions}
        value={projectId}
        onChange={(e) => onProjectChange(e.target.value)}
        placeholder="Select project..."
        disabled={disabled}
      />

      <Select
        label="Assignee"
        options={assigneeOptions}
        value={assignedTo}
        onChange={(e) => onAssignedToChange(e.target.value)}
        disabled={disabled}
      />

      <div>
        <Input
          label="Title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Enter ticket title..."
          maxLength={200}
          disabled={disabled}
          required
        />
        <p
          className="mt-1 text-xs"
          style={{ color: `rgb(var(--text-tertiary))` }}
        >
          {title.length}/200 characters
        </p>
      </div>

      <Select
        label="Status"
        options={statusOptions}
        value={statusId}
        onChange={(e) => onStatusChange(e.target.value)}
        placeholder="Select status..."
        disabled={disabled}
        required
      />

      <div
        className="flex items-center justify-between rounded-lg border p-3"
        style={{
          backgroundColor: `rgb(var(--bg-secondary))`,
          borderColor: `rgb(var(--border-color))`,
        }}
      >
        <div>
          <span
            className="text-sm font-medium"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            Enable Flow
          </span>
          <p
            className="text-xs"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            Enable automatic flow progression
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={flowEnabled}
            onChange={(e) => {
              logger.debug(
                { category: logCategories.CHAT },
                '[[TicketModal] Flow toggle changed]: checked=%s mode=%s ticketType=%s',
                e.target.checked,
                isDraft ? 'draft' : 'active',
                isEditing ? 'edit' : 'create'
              )
              onFlowEnabledChange(e.target.checked)
            }}
            className="peer sr-only"
            disabled={disabled}
          />
          <div
            className="h-6 w-11 rounded-full transition-colors"
            style={{
              backgroundColor: flowEnabled
                ? `rgb(var(--accent-primary, 59 130 246))`
                : `rgb(var(--border-color))`,
            }}
          >
            <div
              className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform"
              style={{
                transform: flowEnabled ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </div>
        </label>
      </div>

      <div
        className="flex items-center justify-between rounded-lg border p-3"
        style={{
          backgroundColor: `rgb(var(--bg-secondary))`,
          borderColor: `rgb(var(--border-color))`,
        }}
      >
        <div>
          <span
            className="text-sm font-medium"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            Sub-Ticket
          </span>
          <p
            className="text-xs"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            Mark as a sub-ticket of another ticket
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={isSubTicket}
            onChange={(e) => onSubTicketChange(e.target.checked)}
            className="peer sr-only"
            disabled={disabled}
          />
          <div
            className="h-6 w-11 rounded-full transition-colors"
            style={{
              backgroundColor: isSubTicket
                ? `rgb(var(--accent-primary, 59 130 246))`
                : `rgb(var(--border-color))`,
            }}
          >
            <div
              className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform"
              style={{
                transform: isSubTicket ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </div>
        </label>
      </div>

      {isSubTicket && (
        <AutocompleteInput
          label="Parent Ticket ID"
          value={parentTicketId}
          onChange={(id) => onParentTicketIdChange(id)}
          placeholder="Search for parent ticket..."
          disabled={disabled}
          excludeTicketId={editingTicketId || undefined}
        />
      )}

      <AutocompleteInput
        label="Wait for Ticket (Optional)"
        value={waitingFinishedTicketId}
        onChange={(id) => onWaitingFinishedTicketIdChange(id)}
        placeholder="Search for a ticket to wait for..."
        disabled={disabled}
        excludeTicketId={editingTicketId || undefined}
      />
    </>
  )
}
