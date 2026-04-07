// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'self-consistency',
  name: 'Universal Self-Consistency',
  description: 'Ensemble method generating multiple responses then synthesizing. Use when you need high confidence.',
  value: `**Description:** Ensemble method generating multiple responses then synthesizing. Use when you need high confidence.

**Format:**
1. Generate 3 distinct responses to the same query
2. Evaluate all responses collectively
3. Select most accurate/relevant elements
4. Synthesize into final output
5. Include confidence score

**Use Cases:** Critical decisions, high-stakes content, technical accuracy, legal/compliance content.

### Example Prompts

**JSON:**
\`\`\`json
{
  "query": "Explain the tax implications of forming an LLC vs S-Corp",
  "steps": [
    "Generate 3 different explanations covering legal, financial, and practical angles",
    "Evaluate which elements are most accurate across all three",
    "Synthesize into single comprehensive answer with confidence score"
  ]
}
\`\`\`

**XML:**
\`\`\`xml
<query>Explain the tax implications of forming an LLC vs S-Corp</query>
<steps>
  <step>Generate 3 different explanations covering legal, financial, and practical angles</step>
  <step>Evaluate which elements are most accurate across all three</step>
  <step>Synthesize into single comprehensive answer with confidence score</step>
</steps>
\`\`\`

**Markdown:**
- **Query:** Explain the tax implications of forming an LLC vs S-Corp
- **Step 1:** Generate 3 different explanations covering legal, financial, and practical angles
- **Step 2:** Evaluate which elements are most accurate across all three
- **Step 3:** Synthesize into single comprehensive answer with confidence score`
}

// OUTPUT: Pure getter function
export function getSelfConsistencyPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
