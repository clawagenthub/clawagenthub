// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'crispe',
  name: 'CRISPE (Capacity/Role, Insight, Statement, Personality, Experiment)',
  description: 'Analytical thinking balanced with exploratory ideation. Use when you want the AI to think deeply AND explore multiple possibilities.',
  value: `**Description:** Analytical thinking balanced with exploratory ideation. Use when you want the AI to think deeply AND explore multiple possibilities.

**Format:**
- Capacity/Role: [Professional role to adopt]
- Insight: [Background context, domain knowledge]
- Statement: [The task declaration]
- Personality: [Communication style, demeanor]
- Experiment: [Whether to explore multiple variants]

**Use Cases:** Strategic planning with scenarios, creative problem-solving, research, architectural decisions.

### Example Prompts

**JSON:**
\`\`\`json
{
  "capacity_role": "Cloud Solutions Architect",
  "insight": "10 years experience with AWS, Kubernetes, microservices",
  "statement": "Design a deployment strategy for a high-traffic e-commerce platform",
  "personality": "Thorough, cost-conscious, pragmatic",
  "experiment": "Propose 2 different approaches and compare tradeoffs"
}
\`\`\`

**XML:**
\`\`\`xml
<capacity_role>Cloud Solutions Architect</capacity_role>
<insight>10 years experience with AWS, Kubernetes, microservices</insight>
<statement>Design a deployment strategy for a high-traffic e-commerce platform</statement>
<personality>Thorough, cost-conscious, pragmatic</personality>
<experiment>Propose 2 different approaches and compare tradeoffs</experiment>
\`\`\`

**Markdown:**
- **Capacity/Role:** Cloud Solutions Architect
- **Insight:** 10 years experience with AWS, Kubernetes, microservices
- **Statement:** Design a deployment strategy for a high-traffic e-commerce platform
- **Personality:** Thorough, cost-conscious, pragmatic
- **Experiment:** Propose 2 different approaches and compare tradeoffs`
}

// OUTPUT: Pure getter function
export function getCrispePrompt(): DefaultPrompt {
  return PROMPT_DATA
}
