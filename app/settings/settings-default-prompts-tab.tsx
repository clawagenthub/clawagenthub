'use client'

import { Button } from '@/components/ui/button'
import { PromptDetailModal } from '@/components/ui/prompt-detail-modal'
import { LoadDefaultPromptsModal } from '@/components/ui/load-default-prompts-modal'
import { AddCustomPromptModal } from '@/components/ui/add-custom-prompt-modal'
import type { WorkspacePrompt } from '@/lib/query/hooks'

interface DefaultPromptsTabProps {
  prompts: WorkspacePrompt[] | undefined
  promptsLoading: boolean
  isPromptModalOpen: boolean
  isLoadDefaultsModalOpen: boolean
  isAddCustomModalOpen: boolean
  selectedPrompt: WorkspacePrompt | null
  onPromptSelect: (prompt: WorkspacePrompt | null) => void
  onPromptModalClose: () => void
  onLoadDefaultsOpen: () => void
  onLoadDefaultsClose: () => void
  onAddCustomOpen: () => void
  onAddCustomClose: () => void
  onDeletePrompt: (promptId: string) => void
  onLoadPrompts: (newPrompts: WorkspacePrompt[]) => void
  onAddPrompt: (prompt: WorkspacePrompt) => Promise<void>
}

export function DefaultPromptsTab({
  prompts,
  promptsLoading,
  isPromptModalOpen,
  isLoadDefaultsModalOpen,
  isAddCustomModalOpen,
  selectedPrompt,
  onPromptSelect,
  onPromptModalClose,
  onLoadDefaultsOpen,
  onLoadDefaultsClose,
  onAddCustomOpen,
  onAddCustomClose,
  onDeletePrompt,
  onLoadPrompts,
  onAddPrompt,
}: DefaultPromptsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Default Prompts</h2>
        <div className="flex items-center gap-2">
          <Button onClick={onLoadDefaultsOpen} variant="outline">
            Load Default Prompts
          </Button>
          <Button onClick={onAddCustomOpen}>
            Add Custom Prompt
          </Button>
        </div>
      </div>

      <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
        Manage prompts that can be loaded into ticket descriptions. Click on a prompt to view details.
      </p>

      {promptsLoading ? (
        <div className="py-8 text-center" style={{ color: 'rgb(var(--text-secondary))' }}>Loading prompts...</div>
      ) : prompts && prompts.length > 0 ? (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'rgb(var(--border-color))' }}>
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="cursor-pointer border-b p-4 transition-colors last:border-b-0 hover:bg-opacity-50"
              style={{ borderColor: 'rgb(var(--border-color))' }}
              onClick={() => onPromptSelect(prompt)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{prompt.name}</p>
                    {prompt.isCustom && (
                      <span className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: 'rgb(var(--primary-color))', color: 'white' }}>Custom</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{prompt.description}</p>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Are you sure you want to delete this prompt?')) {
                      onDeletePrompt(prompt.id)
                    }
                  }}
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                  size="sm"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border py-8 text-center" style={{ borderColor: 'rgb(var(--border-color))', borderStyle: 'dashed' }}>
          <p className="mb-2 text-lg" style={{ color: 'rgb(var(--text-primary))' }}>No prompts configured</p>
          <p className="mb-4 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Load default prompts or add your own custom prompts.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={onLoadDefaultsOpen} variant="outline">Load Default Prompts</Button>
            <Button onClick={onAddCustomOpen}>Add Custom Prompt</Button>
          </div>
        </div>
      )}

      <PromptDetailModal isOpen={isPromptModalOpen} onClose={onPromptModalClose} prompt={selectedPrompt} />
      <LoadDefaultPromptsModal
        isOpen={isLoadDefaultsModalOpen}
        onClose={onLoadDefaultsClose}
        onLoad={onLoadPrompts}
        existingPromptIds={prompts?.map((p) => p.id) || []}
      />
      <AddCustomPromptModal isOpen={isAddCustomModalOpen} onClose={onAddCustomClose} onAdd={onAddPrompt} />
    </div>
  )
}
