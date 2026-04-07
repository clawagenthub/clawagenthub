// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'synthesized-main-prompt',
  name: 'Synthesized Main Prompt Architecture',
  description: 'High-precision framework for complex tasks requiring grounded, realistic outputs with strict structure.',
  value: `**Description:** High-precision framework for complex tasks requiring grounded, realistic outputs with strict structure.

**Format:**
\`\`\`xml
<master_prompt_framework>
  <system_directives>
    <role>[Who the AI should act as]</role>
    <audience>[Who will receive/use the output]</audience>
  </system_directives>
  
  <context_and_grounding>
    <reference_data>[All data sources, references, code to consider]</reference_data>
    <background>[General business objective, current state, problem statement]</background>
  </context_and_grounding>
  
  <execution_protocol>
    <objective>[Exact final goal to achieve]</objective>
    <computational_methodology>
      [Methodology selection: Tree of Thoughts, Step-Back, Flipped Interaction, etc.]
    </computational_methodology>
  </execution_protocol>
  
  <constraints_and_verification>
    <negative_constraints>[What to avoid, topics/codes not to touch]</negative_constraints>
    <formatting_contract>[Exact output format specification]</formatting_contract>
    <quality_assurance>[Self-verification steps before final output]</quality_assurance>
  </constraints_and_verification>
  
  <few_shot_examples>
    <example>
      <input>[Example Input]</input>
      <ideal_output>[Example Ideal Output]</ideal_output>
    </example>
  </few_shot_examples>
  
  <affective_stimulus>
    [Emotional prompting or urgency statement]
  </affective_stimulus>
</master_prompt_framework>
\`\`\`

**Use Cases:** Enterprise-grade applications, complex multi-step tasks, high-stakes outputs requiring verification.

### Example Prompts

**JSON:**
\`\`\`json
{
  "master_prompt_framework": {
    "system_directives": {
      "role": "Senior Security Architect",
      "audience": "Development team leads"
    },
    "context_and_grounding": {
      "reference_data": "OWASP Top 10 2023, company security policy v2.1",
      "background": "Migrate legacy authentication system to modern OAuth2/OIDC solution"
    },
    "execution_protocol": {
      "objective": "Create comprehensive migration plan with timeline and risk assessment",
      "computational_methodology": "Tree of Thoughts: Generate 3 approaches, evaluate tradeoffs, select optimal"
    },
    "constraints_and_verification": {
      "negative_constraints": "No proprietary encryption, must comply with SOC2",
      "formatting_contract": "Markdown with sections, diagrams in Mermaid, risk matrix table",
      "quality_assurance": "Self-verify against OWASP guidelines before output"
    },
    "few_shot_examples": {
      "input": "Legacy: Session-based auth with cookies",
      "ideal_output": "OAuth2 with JWT access tokens + refresh token rotation"
    },
    "affective_stimulus": "This migration affects 2M users. Accuracy is critical."
  }
}
\`\`\`

**XML:**
\`\`\`xml
<master_prompt_framework>
  <system_directives>
    <role>Senior Security Architect</role>
    <audience>Development team leads</audience>
  </system_directives>
  <context_and_grounding>
    <reference_data>OWASP Top 10 2023, company security policy v2.1</reference_data>
    <background>Migrate legacy authentication system to modern OAuth2/OIDC solution</background>
  </context_and_grounding>
  <execution_protocol>
    <objective>Create comprehensive migration plan with timeline and risk assessment</objective>
    <computational_methodology>Tree of Thoughts: Generate 3 approaches, evaluate tradeoffs, select optimal</computational_methodology>
  </execution_protocol>
  <constraints_and_verification>
    <negative_constraints>No proprietary encryption, must comply with SOC2</negative_constraints>
    <formatting_contract>Markdown with sections, diagrams in Mermaid, risk matrix table</formatting_contract>
    <quality_assurance>Self-verify against OWASP guidelines before output</quality_assurance>
  </constraints_and_verification>
  <few_shot_examples>
    <example>
      <input>Legacy: Session-based auth with cookies</input>
      <ideal_output>OAuth2 with JWT access tokens + refresh token rotation</ideal_output>
    </example>
  </few_shot_examples>
  <affective_stimulus>This migration affects 2M users. Accuracy is critical.</affective_stimulus>
</master_prompt_framework>
\`\`\`

**Markdown:**
- **Role:** Senior Security Architect
- **Audience:** Development team leads
- **Reference Data:** OWASP Top 10 2023, company security policy v2.1
- **Background:** Migrate legacy authentication system to modern OAuth2/OIDC solution
- **Objective:** Create comprehensive migration plan with timeline and risk assessment
- **Methodology:** Tree of Thoughts - Generate 3 approaches, evaluate tradeoffs, select optimal
- **Constraints:** No proprietary encryption, must comply with SOC2
- **Format:** Markdown with sections, diagrams in Mermaid, risk matrix table
- **Quality Check:** Self-verify against OWASP guidelines before output
- **Example Input:** Legacy: Session-based auth with cookies
- **Example Output:** OAuth2 with JWT access tokens + refresh token rotation
- **Affective Stimulus:** This migration affects 2M users. Accuracy is critical.`
}

// OUTPUT: Pure getter function
export function getSynthesizedMainPromptPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
