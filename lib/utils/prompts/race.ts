// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'race',
  name: 'RACE (Role, Action, Context, Expectation)',
  description: 'Adds expectation component to RTF for clearer success criteria. Use when you need specific quality standards or criteria met.',
  value: `**Description:** Adds expectation component to RTF for clearer success criteria. Use when you need specific quality standards or criteria met.

**Format:**
- Role: [Who the AI should act as]
- Action: [What specifically to do]
- Context: [Background information, situation]
- Expectation: [How to measure success, quality standards]

**Use Cases:** Code reviews with criteria, content with success metrics, technical specifications, performance evaluations.

### Example Prompts

**JSON:**
\`\`\`json
{
  "role": "Code Reviewer",
  "action": "Review the following function for security vulnerabilities",
  "context": "This function handles user authentication tokens",
  "expectation": "List vulnerabilities found, rate severity as Low/Medium/High, suggest fixes"
}
\`\`\`

**XML:**
\`\`\`xml
<role>Code Reviewer</role>
<action>Review the following function for security vulnerabilities</action>
<context>This function handles user authentication tokens</context>
<expectation>List vulnerabilities found, rate severity as Low/Medium/High, suggest fixes</expectation>
\`\`\`

**Markdown:**
- **Role:** Code Reviewer
- **Action:** Review the following function for security vulnerabilities
- **Context:** This function handles user authentication tokens
- **Expectation:** List vulnerabilities found, rate severity as Low/Medium/High, suggest fixes`
}

// OUTPUT: Pure getter function
export function getRacePrompt(): DefaultPrompt {
  return PROMPT_DATA
}
