// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'create',
  name: 'CREATE (Context, Request, Explanation, Action, Tone, Extras)',
  description: 'Intricate multi-step projects with strict constraints. Use when you have precise requirements.',
  value: `**Description:** Intricate multi-step projects with strict constraints. Use when you have precise requirements.

**Format:**
- Context: [Background information]
- Request: [The specific ask]
- Explanation: [Why this matters, constraints]
- Action: [Step-by-step approach]
- Tone: [Voice and style]
- Extras: [Word count, formatting rules, deadlines]

**Use Cases:** Academic writing, technical documentation, legal documents, press releases.

### Example Prompts

**JSON:**
\`\`\`json
{
  "context": "Product launch for new smartphone",
  "request": "Write a press release announcing the product",
  "explanation": "Must appeal to tech journalists and consumers; avoid technical jargon",
  "action": "Start with headline, then lead paragraph, then 3 key points, then quote, then boilerplate",
  "tone": "Professional, exciting, credible",
  "extras": "Maximum 400 words, include contact info"
}
\`\`\`

**XML:**
\`\`\`xml
<context>Product launch for new smartphone</context>
<request>Write a press release announcing the product</request>
<explanation>Must appeal to tech journalists and consumers; avoid technical jargon</explanation>
<action>Start with headline, then lead paragraph, then 3 key points, then quote, then boilerplate</action>
<tone>Professional, exciting, credible</tone>
<extras>Maximum 400 words, include contact info</extras>
\`\`\`

**Markdown:**
- **Context:** Product launch for new smartphone
- **Request:** Write a press release announcing the product
- **Explanation:** Must appeal to tech journalists and consumers; avoid technical jargon
- **Action:** Start with headline, then lead paragraph, then 3 key points, then quote, then boilerplate
- **Tone:** Professional, exciting, credible
- **Extras:** Maximum 400 words, include contact info`
}

// OUTPUT: Pure getter function
export function getCreatePrompt(): DefaultPrompt {
  return PROMPT_DATA
}
