// Re-export from modular prompts structure
// Original file refactored to comply with 250-line ESLint rule

export {
  type PromptTemplate,
  DEFAULT_PROMPTS,
  getPromptById,
  getPromptsByIds,
} from './prompts'

// Keep legacy interface for backwards compatibility
export type { default as DefaultPrompt } from './prompts/types'