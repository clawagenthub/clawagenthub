// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'chain-of-verification',
  name: 'Chain of Verification',
  description: 'Four-stage self-fact-checking pipeline. Use when accuracy is critical.',
  value: `**Description:** Four-stage self-fact-checking pipeline. Use when accuracy is critical.

**Format:**
1. Generate baseline draft response
2. Extract factual claims from draft
3. Generate verification questions for each claim
4. Answer questions independently (without referencing draft)
5. Compare answers to draft, correct unsupported claims
6. Produce final verified response

**Use Cases:** News reporting, technical documentation, legal content, medical information, financial advice.

### Example Prompts

**JSON:**
\`\`\`json
{
  "topic": "Explain how blockchain technology works",
  "draft": "Blockchain is a distributed ledger...",
  "verification": [
    "Is blockchain literally distributed?",
    "What does 'distributed' mean in this context?"
  ],
  "check": "Answer without reference to draft, verify against known facts",
  "final": "Corrected verified explanation"
}
\`\`\`

**XML:**
\`\`\`xml
<topic>Explain how blockchain technology works</topic>
<draft>Blockchain is a distributed ledger...</draft>
<verification>
  <question>Is blockchain literally distributed?</question>
  <question>What does 'distributed' mean in this context?</question>
</verification>
<check>Answer without reference to draft, verify against known facts</check>
<final>Corrected verified explanation</final>
\`\`\`

**Markdown:**
- **Topic:** Explain how blockchain technology works
- **Draft:** Blockchain is a distributed ledger...
- **Verification Questions:** Is blockchain literally distributed? What does "distributed" mean in this context?
- **Check:** Answer without reference to draft, verify against known facts
- **Final:** Corrected verified explanation`
}

// OUTPUT: Pure getter function
export function getChainOfVerificationPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
