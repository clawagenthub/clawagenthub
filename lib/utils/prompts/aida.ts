// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'aida',
  name: 'AIDA (Attention, Interest, Desire, Action)',
  description: 'Persuasive copywriting and behavioral conversion. Use when you want someone to take a specific action.',
  value: `**Description:** Persuasive copywriting and behavioral conversion. Use when you want someone to take a specific action.

**Format:**
- Attention: [Hook - grab attention immediately]
- Interest: [Build interest with details, benefits]
- Desire: [Create desire - connect to pain points]
- Action: [Clear call to action]

**Use Cases:** Landing pages, sales emails, advertisements, social media campaigns, product descriptions.

### Example Prompts

**JSON:**
\`\`\`json
{
  "attention": "90% of startups fail within the first year",
  "interest": "The difference isn't ideas—it's execution. Our platform gives you the tools Fortune 500 companies use at a fraction of the cost",
  "desire": "Imagine having project management, team communication, and analytics in one place. No more juggling 10 different apps",
  "action": "Start your free 14-day trial today at example.com"
}
\`\`\`

**XML:**
\`\`\`xml
<attention>90% of startups fail within the first year</attention>
<interest>The difference isn't ideas—it's execution. Our platform gives you the tools Fortune 500 companies use at a fraction of the cost</interest>
<desire>Imagine having project management, team communication, and analytics in one place. No more juggling 10 different apps</desire>
<action>Start your free 14-day trial today at example.com</action>
\`\`\`

**Markdown:**
- **Attention:** 90% of startups fail within the first year
- **Interest:** The difference isn't ideas—it's execution. Our platform gives you the tools Fortune 500 companies use at a fraction of the cost
- **Desire:** Imagine having project management, team communication, and analytics in one place. No more juggling 10 different apps
- **Action:** Start your free 14-day trial today at example.com`
}

// OUTPUT: Pure getter function
export function getAidaPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
