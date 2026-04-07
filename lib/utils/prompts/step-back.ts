// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'step-back',
  name: 'Step-Back Abstraction',
  description: 'Forces identification of foundational principles before solving. Use when stuck on granular details.',
  value: `**Description:** Forces identification of foundational principles before solving. Use when stuck on granular details.

**Format:**
1. Step back to ask: [broader generic question about underlying principle]
2. Answer the broader principle (let AI do this)
3. Apply to specific granular problem

**Use Cases:** Physics/engineering problems, architectural decisions, debugging root cause, learning complex concepts.

### Example Prompts

**JSON:**
\`\`\`json
{
  "problem": "Calculate heat dissipation required for a data center rack consuming 15kW",
  "step_back": "What are the fundamental principles of heat transfer and thermodynamics?",
  "answer": "Heat flows from higher to lower temperature, following Fourier's law. Specific heat capacity determines temperature rise.",
  "apply": "Use heat dissipation formula Q = mcΔT to calculate required cooling capacity"
}
\`\`\`

**XML:**
\`\`\`xml
<problem>Calculate heat dissipation required for a data center rack consuming 15kW</problem>
<step_back>What are the fundamental principles of heat transfer and thermodynamics?</step_back>
<answer>Heat flows from higher to lower temperature, following Fourier's law. Specific heat capacity determines temperature rise.</answer>
<apply>Use heat dissipation formula Q = mcΔT to calculate required cooling capacity</apply>
\`\`\`

**Markdown:**
- **Problem:** Calculate heat dissipation required for a data center rack consuming 15kW
- **Step-Back:** What are the fundamental principles of heat transfer and thermodynamics?
- **Answer:** Heat flows from higher to lower temperature, following Fourier's law. Specific heat capacity determines temperature rise.
- **Apply:** Use heat dissipation formula Q = mcΔT to calculate required cooling capacity`
}

// OUTPUT: Pure getter function
export function getStepBackPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
