// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'care',
  name: 'CARE (Context, Action, Result, Example)',
  description: 'High-precision tasks requiring grounded, realistic outputs. Use when examples are critical for accuracy.',
  value: `**Description:** High-precision tasks requiring grounded, realistic outputs. Use when examples are critical for accuracy.

**Format:**
- Context: [Situation, background, environment]
- Action: [Specific action to take]
- Result: [Expected outcome]
- Example: [Concrete input/output example]

**Use Cases:** Code generation with patterns, data transformation, UI components, API response formatting.

### Example Prompts

**JSON:**
\`\`\`json
{
  "context": "REST API endpoint that returns user data",
  "action": "Generate a JSON response schema for user profile",
  "result": "Valid JSON Schema that includes id, name, email, created_at fields",
  "example": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-01-01"
  }
}
\`\`\`

**XML:**
\`\`\`xml
<context>REST API endpoint that returns user data</context>
<action>Generate a JSON response schema for user profile</action>
<result>Valid JSON Schema that includes id, name, email, created_at fields</result>
<example>
  <id>123</id>
  <name>John Doe</name>
  <email>john@example.com</email>
  <created_at>2024-01-01</created_at>
</example>
\`\`\`

**Markdown:**
- **Context:** REST API endpoint that returns user data
- **Action:** Generate a JSON response schema for user profile
- **Result:** Valid JSON Schema that includes id, name, email, created_at fields
- **Example:**
  \`\`\`json
  { "id": 123, "name": "John Doe", "email": "john@example.com", "created_at": "2024-01-01" }
  \`\`\``
}

// OUTPUT: Pure getter function
export function getCarePrompt(): DefaultPrompt {
  return PROMPT_DATA
}
