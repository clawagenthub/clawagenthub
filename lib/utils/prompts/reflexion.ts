// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'reflexion',
  name: 'Reflexion',
  description: 'Self-critique and recursive improvement loop. Use when you want quality improvement.',
  value: `**Description:** Self-critique and recursive improvement loop. Use when you want quality improvement.

**Format:**
1. Generate initial response
2. Define quality criteria to check against
3. Self-critique: What are weaknesses, blind spots, errors?
4. Generate improved version addressing critiques
5. (Optional) Repeat until satisfied

**Use Cases:** Code optimization, writing refinement, strategic plans, problem solutions.

### Example Prompts

**JSON:**
\`\`\`json
{
  "task": "Write a REST API design document",
  "self_critique": "Did I cover authentication? Are error responses defined? Is versioning addressed?",
  "improved": "Add OAuth2 section, define 4xx error codes, add /v1/ prefix to endpoints"
}
\`\`\`

**XML:**
\`\`\`xml
<task>Write a REST API design document</task>
<self_critique>Did I cover authentication? Are error responses defined? Is versioning addressed?</self_critique>
<improved>Add OAuth2 section, define 4xx error codes, add /v1/ prefix to endpoints</improved>
\`\`\`

**Markdown:**
- **Task:** Write a REST API design document
- **Self-critique:** Did I cover authentication? Are error responses defined? Is versioning addressed?
- **Improved:** Add OAuth2 section, define 4xx error codes, add /v1/ prefix to endpoints`
}

// OUTPUT: Pure getter function
export function getReflexionPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
