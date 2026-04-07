// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'bab',
  name: 'BAB (Before, After, Bridge)',
  description: 'Persuasive storytelling approach. Use when you want to show transformation.',
  value: `**Description:** Persuasive storytelling approach. Use when you want to show transformation.

**Format:**
- Before: [Current situation - problem, pain, limitation]
- After: [Desired outcome - aspirational state]
- Bridge: [How to get from before to after]

**Use Cases:** Case studies, testimonials, brand storytelling, conversion pages, client proposals.

### Example Prompts

**JSON:**
\`\`\`json
{
  "before": "You spend hours every week manually entering data into spreadsheets. Errors pile up. Your team is frustrated.",
  "after": "Your data syncs automatically across all tools. Errors are eliminated. Your team focuses on insights, not data entry.",
  "bridge": "Our integration platform connects your existing tools and automates data flow. Setup takes 15 minutes, no coding required."
}
\`\`\`

**XML:**
\`\`\`xml
<before>You spend hours every week manually entering data into spreadsheets. Errors pile up. Your team is frustrated.</before>
<after>Your data syncs automatically across all tools. Errors are eliminated. Your team focuses on insights, not data entry.</after>
<bridge>Our integration platform connects your existing tools and automates data flow. Setup takes 15 minutes, no coding required.</bridge>
\`\`\`

**Markdown:**
- **Before:** You spend hours every week manually entering data into spreadsheets. Errors pile up. Your team is frustrated.
- **After:** Your data syncs automatically across all tools. Errors are eliminated. Your team focuses on insights, not data entry.
- **Bridge:** Our integration platform connects your existing tools and automates data flow. Setup takes 15 minutes, no coding required.`
}

// OUTPUT: Pure getter function
export function getBabPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
