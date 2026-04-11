'use client'

import React from 'react'
import { Modal } from '@/components/ui/modal'
import { SelectPromptModal } from '@/components/ui/select-prompt-modal'
import { FLOW_MODE_OPTIONS } from './ticket-modal-form-utils'
import { useTicketModalCoreState } from './hooks/use-ticket-modal-core-state'
import { useTicketModalQueries } from './hooks/use-ticket-modal-queries'
import { useTicketModalEffects } from './hooks/use-ticket-modal-effects'
import { useTicketModalActions } from './hooks/use-ticket-modal-actions'
import { TicketBasicFieldsSection } from './sections/ticket-basic-fields-section'
import { TicketPromptSection } from './sections/ticket-prompt-section'
import { TicketDescriptionSection } from './sections/ticket-description-section'
import { TicketFlowConfigSection } from './sections/ticket-flow-config-section'
import { TicketActionButtonsSection } from './sections/ticket-action-buttons-section'
import type { TicketModalProps } from './ticket-modal.types'

export type { TicketModalProps } from './ticket-modal.types'

export function TicketModalContent({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
  onSwitchToView,
  onSaveAndView,
  onDelete,
}: TicketModalProps) {
  const state = useTicketModalCoreState(initialData)
  const queries = useTicketModalQueries(initialData)

  useTicketModalEffects({ isOpen, initialData, state, queries })

  const actions = useTicketModalActions({
    state,
    queries,
    onSubmit,
    onClose,
    initialData,
  })

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={actions.handleCancel}
        title={actions.modalTitle}
        dismissible={!isSubmitting}
        size="xl"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void actions.handleSubmit('active')
          }}
        >
          <TicketBasicFieldsSection
            projectOptions={queries.projectOptions}
            projectId={state.projectId}
            onProjectChange={state.setProjectId}
            assigneeOptions={queries.assigneeOptions}
            assignedTo={state.assignedTo}
            onAssignedToChange={state.setAssignedTo}
            title={state.title}
            onTitleChange={state.setTitle}
            statusOptions={queries.statusOptions}
            statusId={state.statusId}
            onStatusChange={state.setStatusId}
            flowEnabled={state.flowEnabled}
            onFlowEnabledChange={state.setFlowEnabled}
            isDraft={actions.isDraft}
            isEditing={actions.isEditing}
            isSubTicket={state.isSubTicket}
            onSubTicketChange={state.setIsSubTicket}
            parentTicketId={state.parentTicketId}
            onParentTicketIdChange={state.setParentTicketId}
            waitingFinishedTicketId={state.waitingFinishedTicketId}
            onWaitingFinishedTicketIdChange={state.setWaitingFinishedTicketId}
            editingTicketId={queries.editingTicketId}
            disabled={isSubmitting}
          />

          <TicketPromptSection
            description={state.description}
            draftTicketId={state.draftTicketId}
            initialTicketId={initialData?.id}
            isSubmitting={isSubmitting}
            isAutoPromptLoading={state.isAutoPromptLoading}
            promptCount={queries.workspacePrompts?.length ?? 0}
            onOpenPromptModal={() => state.setIsPromptModalOpen(true)}
            onAutoPromptLoadingChange={state.setIsAutoPromptLoading}
            onDescriptionChange={state.setDescription}
            onUpdateDescription={async (ticketId, nextDescription) => {
              await queries.updateTicket({
                id: ticketId,
                description: nextDescription,
              })
            }}
          />

          <TicketDescriptionSection
            description={state.description}
            onDescriptionChange={state.setDescription}
            attachments={state.descriptionAttachments}
            onAttachmentsChange={state.setDescriptionAttachments}
            showPreview={state.showDescriptionPreview}
            onShowPreviewChange={state.setShowDescriptionPreview}
            maxImagesPerPost={state.maxImagesPerPost}
            allowPdfAttachments={state.allowPdfAttachments}
            disabled={isSubmitting}
          />

          <TicketFlowConfigSection
            flowEnabled={state.flowEnabled}
            flowMode={state.flowMode}
            onFlowModeChange={state.setFlowMode}
            statuses={queries.statuses}
            flowConfigs={state.flowConfigs}
            availableAgents={queries.gatewayAgents?.map((agent) => ({
              id: agent.agentId,
              name: `${agent.agentName} (${agent.gatewayName})`,
            }))}
            canLoadDefaultConfig={actions.canLoadDefaultConfig}
            onLoadDefaultClick={() => state.setIsLoadDefaultsConfirmOpen(true)}
            onFlowConfigsChange={actions.handleFlowConfigsChange}
            disabled={isSubmitting}
            flowModeOptions={FLOW_MODE_OPTIONS}
          />

          <TicketActionButtonsSection
            isEditing={actions.isEditing}
            isDraft={actions.isDraft}
            isSubmitting={isSubmitting}
            isDraftSubmitting={actions.isDraftSubmitting}
            isPublishSubmitting={actions.isPublishSubmitting}
            title={state.title}
            statusId={state.statusId}
            canControlFlowRuntime={actions.canControlFlowRuntime}
            isFlowingNow={actions.isFlowingNow}
            isFlowActionPending={actions.isFlowActionPending}
            onDelete={onDelete}
            onSwitchToView={onSwitchToView}
            onSaveAndView={onSaveAndView}
            onCancel={actions.handleCancel}
            onSubmit={(creationStatus, switchToView) => {
              void actions.handleSubmit(creationStatus, switchToView)
            }}
            onStartFlow={() => {
              void actions.handleStartFlow()
            }}
            onStopFlow={() => {
              void actions.handleStopFlow()
            }}
          />
        </form>
      </Modal>

      <Modal
        isOpen={state.isLoadDefaultsConfirmOpen}
        onClose={() => state.setIsLoadDefaultsConfirmOpen(false)}
        title="Load Default Flow Config"
        dismissible={!isSubmitting}
      >
        <div className="space-y-4">
          <p style={{ color: `rgb(var(--text-secondary))` }}>
            Are you sure you want to load default flow config from statuses?
            This will overwrite the current flow configuration.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => state.setIsLoadDefaultsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-md px-4 py-2 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={actions.handleLoadDefaultConfig}
              disabled={isSubmitting}
              className="rounded-md px-4 py-2 font-medium"
            >
              Yes, Load Defaults
            </button>
          </div>
        </div>
      </Modal>

      <SelectPromptModal
        isOpen={state.isPromptModalOpen}
        onClose={() => state.setIsPromptModalOpen(false)}
        prompts={queries.workspacePrompts || []}
        onSelect={(promptContent) => {
          const current = state.description.trim()
          const promptSection = `\n\n---\n${promptContent}\n`
          state.setDescription(
            current ? `${current}${promptSection}` : promptContent
          )
        }}
      />
    </>
  )
}

export const TicketModal = TicketModalContent
