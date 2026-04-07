// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'rtf',
  name: 'RTF (Role, Task, Format)',
  description: 'Simple framework for basic prompting with clear structure. Best for straightforward tasks where you need a specific output without complex reasoning.',
  value: `**Description:** Simple framework for basic prompting with clear structure. Best for straightforward tasks where you need a specific output without complex reasoning.

**Format:**
- Role: [Who the AI should act as]
- Task: [The specific action you want performed]
- Format: [How the output should be structured]

**Use Cases:** Writing simple emails, quick code snippets, basic Q&A, formatting existing content.

### Example Prompts

**JSON:**
\`\`\`json
{
  "role": "Senior Backend Engineer",
  "task": "Write a function to validate email addresses in JavaScript",
  "format": "Provide the code in a single code block with inline comments"
}
\`\`\`

**XML:**
\`\`\`xml
<role>Senior Backend Engineer</role>
<task>Write a function to validate email addresses in JavaScript</task>
<format>Provide the code in a single code block with inline comments</format>
\`\`\`

**Markdown:**
- **Role:** Senior Backend Engineer
- **Task:** Write a function to validate email addresses in JavaScript
- **Format:** Provide the code in a single code block with inline comments`
}

// OUTPUT: Pure getter function
export function getRtfPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
