// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'pas',
  name: 'PAS (Problem, Agitate, Solution)',
  description: 'Marketing and problem-solving persuasion. Use when you want to deeply connect with audience pain before presenting solution.',
  value: `**Description:** Marketing and problem-solving persuasion. Use when you want to deeply connect with audience pain before presenting solution.

**Format:**
- Problem: [Specific problem your audience faces]
- Agitate: [Emotional and practical consequences]
- Solution: [Your solution as the answer]

**Use Cases:** Sales pages, lead nurturing emails, solution selling, consultative selling.

### Example Prompts

**JSON:**
\`\`\`json
{
  "problem": "Your team is losing 10+ hours weekly chasing down status updates from different departments. Meetings that should take 30 minutes run for 90.",
  "agitate": "This isn't just annoying—it's expensive. That's 500 hours a year of lost productivity. While your competitors ship faster, your team is stuck in email chains. Good employees are leaving.",
  "solution": "Our project visibility platform gives every team member real-time access to exactly what they need. No more status meetings. Teams ship 40% faster."
}
\`\`\`

**XML:**
\`\`\`xml
<problem>Your team is losing 10+ hours weekly chasing down status updates from different departments. Meetings that should take 30 minutes run for 90.</problem>
<agitate>This isn't just annoying—it's expensive. That's 500 hours a year of lost productivity. While your competitors ship faster, your team is stuck in email chains. Good employees are leaving.</agitate>
<solution>Our project visibility platform gives every team member real-time access to exactly what they need. No more status meetings. Teams ship 40% faster.</solution>
\`\`\`

**Markdown:**
- **Problem:** Your team is losing 10+ hours weekly chasing down status updates from different departments. Meetings that should take 30 minutes run for 90.
- **Agitate:** This isn't just annoying—it's expensive. That's 500 hours a year of lost productivity. While your competitors ship faster, your team is stuck in email chains. Good employees are leaving.
- **Solution:** Our project visibility platform gives every team member real-time access to exactly what they need. No more status meetings. Teams ship 40% faster.`
}

// OUTPUT: Pure getter function
export function getPasPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
