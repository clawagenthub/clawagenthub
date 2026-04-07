// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'flipped-interaction',
  name: 'Flipped Interaction Pattern',
  description: 'Model takes control to ask targeted questions. Use when you do not know what context is needed.',
  value: `**Description:** Model takes control to ask targeted questions. Use when you do not know what context is needed.

**Format:**
1. Define role and problem
2. Instruct model to ask N specific questions
3. Model asks questions one at a time
4. User answers each
5. Model synthesizes only after receiving answers

**Use Cases:** Diagnostic scenarios, consulting first meetings, troubleshooting, requirements gathering.

### Example Prompts

**JSON:**
\`\`\`json
{
  "role": "DevOps consultant",
  "task": "Help me optimize my deployment pipeline",
  "instruction": "Ask me up to 5 questions, one at a time, to understand my setup. Wait for my answer before asking next. Then provide recommendations."
}
\`\`\`

**XML:**
\`\`\`xml
<role>DevOps consultant</role>
<task>Help me optimize my deployment pipeline</task>
<instruction>Ask me up to 5 questions, one at a time, to understand my setup. Wait for my answer before asking next. Then provide recommendations.</instruction>
\`\`\`

**Markdown:**
- **Role:** DevOps consultant
- **Task:** Help me optimize my deployment pipeline
- **Instruction:** Ask me up to 5 questions, one at a time, to understand my setup. Wait for my answer before asking next. Then provide recommendations.`
}

// OUTPUT: Pure getter function
export function getFlippedInteractionPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
