// Re-export types
export type { DefaultPrompt } from './types'

// Import all getter functions
import { getRtfPrompt } from './rtf'
import { getRacePrompt } from './race'
import { getCoStarPrompt } from './co-star'
import { getCrispePrompt } from './crispe'
import { getCarePrompt } from './care'
import { getCreatePrompt } from './create'
import { getAidaPrompt } from './aida'
import { getBabPrompt } from './bab'
import { getPasPrompt } from './pas'
import { getFabPrompt } from './fab'
import { getTreeOfThoughtsPrompt } from './tree-of-thoughts'
import { getStepBackPrompt } from './step-back'
import { getSelfConsistencyPrompt } from './self-consistency'
import { getChainOfDensityPrompt } from './chain-of-density'
import { getChainOfVerificationPrompt } from './chain-of-verification'
import { getReflexionPrompt } from './reflexion'
import { getFlippedInteractionPrompt } from './flipped-interaction'
import { getCognitiveVerifierPrompt } from './cognitive-verifier'
import { getSynthesizedMainPromptPrompt } from './synthesized-main-prompt'

// Re-export all getter functions
export {
  getRtfPrompt,
  getRacePrompt,
  getCoStarPrompt,
  getCrispePrompt,
  getCarePrompt,
  getCreatePrompt,
  getAidaPrompt,
  getBabPrompt,
  getPasPrompt,
  getFabPrompt,
  getTreeOfThoughtsPrompt,
  getStepBackPrompt,
  getSelfConsistencyPrompt,
  getChainOfDensityPrompt,
  getChainOfVerificationPrompt,
  getReflexionPrompt,
  getFlippedInteractionPrompt,
  getCognitiveVerifierPrompt,
  getSynthesizedMainPromptPrompt,
}

// Utility functions (MAINTAIN ORIGINAL API CONTRACT)
import type { DefaultPrompt } from './types'

// Build array from getter functions for backward compatibility
const ALL_PROMPTS: DefaultPrompt[] = [
  getRtfPrompt(),
  getRacePrompt(),
  getCoStarPrompt(),
  getCrispePrompt(),
  getCarePrompt(),
  getCreatePrompt(),
  getAidaPrompt(),
  getBabPrompt(),
  getPasPrompt(),
  getFabPrompt(),
  getTreeOfThoughtsPrompt(),
  getStepBackPrompt(),
  getSelfConsistencyPrompt(),
  getChainOfDensityPrompt(),
  getChainOfVerificationPrompt(),
  getReflexionPrompt(),
  getFlippedInteractionPrompt(),
  getCognitiveVerifierPrompt(),
  getSynthesizedMainPromptPrompt(),
]

// Backward-compatible DEFAULT_PROMPTS array
export const DEFAULT_PROMPTS: DefaultPrompt[] = ALL_PROMPTS

// Utility functions
export function getPromptById(id: string): DefaultPrompt | undefined {
  return ALL_PROMPTS.find((p) => p.id === id)
}

export function getPromptsByIds(ids: string[]): DefaultPrompt[] {
  return ALL_PROMPTS.filter((p) => ids.includes(p.id))
}
