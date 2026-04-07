// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'tree-of-thoughts',
  name: 'Tree of Thoughts',
  description: 'Branching reasoning for complex strategic exploration. Use when decision has multiple valid paths and consequences.',
  value: `**Description:** Branching reasoning for complex strategic exploration. Use when decision has multiple valid paths and consequences.

**Format:**
1. Define the problem clearly
2. Generate 3 distinct solution approaches
3. Evaluate each approach (sure/maybe/impossible)
4. Eliminate flawed approaches
5. Proceed with most robust, documenting reasoning

**Use Cases:** Architectural decisions, strategic planning, debugging, business decisions with tradeoffs.

### Example Prompts

**JSON:**
\`\`\`json
{
  "problem": "Need to reduce database query time from 3 seconds to under 500ms",
  "thoughts": [
    { "approach": "Add database index", "evaluation": "Maybe", "note": "Speeds reads but slows writes" },
    { "approach": "Implement caching layer", "evaluation": "Sure", "note": "Reduces load but adds complexity" },
    { "approach": "Denormalize database schema", "evaluation": "Maybe", "note": "Improves reads but complicates updates" }
  ],
  "decision": "Proceed with caching layer first, then evaluate indexing if needed"
}
\`\`\`

**XML:**
\`\`\`xml
<problem>Need to reduce database query time from 3 seconds to under 500ms</problem>
<thoughts>
  <thought evaluation="Maybe">
    <approach>Add database index</approach>
    <note>Speeds reads but slows writes</note>
  </thought>
  <thought evaluation="Sure">
    <approach>Implement caching layer</approach>
    <note>Reduces load but adds complexity</note>
  </thought>
  <thought evaluation="Maybe">
    <approach>Denormalize database schema</approach>
    <note>Improves reads but complicates updates</note>
  </thought>
</thoughts>
<decision>Proceed with caching layer first, then evaluate indexing if needed</decision>
\`\`\`

**Markdown:**
- **Problem:** Need to reduce database query time from 3 seconds to under 500ms
- **Thought 1:** Add database index - Evaluate: Maybe - Speeds reads but slows writes
- **Thought 2:** Implement caching layer - Evaluate: Sure - Reduces load but adds complexity
- **Thought 3:** Denormalize database schema - Evaluate: Maybe - Improves reads but complicates updates
- **Decision:** Proceed with caching layer first, then evaluate indexing if needed`
}

// OUTPUT: Pure getter function
export function getTreeOfThoughtsPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
