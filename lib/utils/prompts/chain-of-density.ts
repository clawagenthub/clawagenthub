// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'chain-of-density',
  name: 'Chain of Density',
  description: 'Iterative compression for high-entity-density summaries. Use when summarizing documents.',
  value: `**Description:** Iterative compression for high-entity-density summaries. Use when summarizing documents.

**Format:**
1. Generate initial sparse draft
2. Identify entities, facts, claims not yet included
3. Compress filler, fuse new entities into text
4. Repeat until density is ~0.15 entities per token
5. Never drop previously included entities

**Use Cases:** News article summaries, research paper abstracts, meeting notes, legal document summaries.

### Example Prompts

**JSON:**
\`\`\`json
{
  "source": "2000-word article about AI regulation in EU",
  "draft_1": "The EU has passed new AI regulations. These affect companies using AI. There are penalties for non-compliance.",
  "iteration_2": "Add EU AI Act, high-risk systems, €30 million fine, 2026 enforcement",
  "iteration_3": "Add specific sectors (healthcare, hiring, facial recognition), certification requirements",
  "final": "Dense summary with all key entities retained"
}
\`\`\`

**XML:**
\`\`\`xml
<source>2000-word article about AI regulation in EU</source>
<draft_1>The EU has passed new AI regulations. These affect companies using AI. There are penalties for non-compliance.</draft_1>
<iteration_2>Add EU AI Act, high-risk systems, €30 million fine, 2026 enforcement</iteration_2>
<iteration_3>Add specific sectors (healthcare, hiring, facial recognition), certification requirements</iteration_3>
<final>Dense summary with all key entities retained</final>
\`\`\`

**Markdown:**
- **Source:** 2000-word article about AI regulation in EU
- **Draft 1:** The EU has passed new AI regulations. These affect companies using AI. There are penalties for non-compliance.
- **Iteration 2:** Add "EU AI Act", "high-risk systems", "€30 million fine", "2026 enforcement"
- **Iteration 3:** Add specific sectors (healthcare, hiring, facial recognition), certification requirements
- **Final:** Dense summary with all key entities retained`
}

// OUTPUT: Pure getter function
export function getChainOfDensityPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
