// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'cognitive-verifier',
  name: 'Cognitive Verifier Pattern',
  description: 'Model breaks complex request into sub-questions. Use when problem has hidden dependencies.',
  value: `**Description:** Model breaks complex request into sub-questions. Use when problem has hidden dependencies.

**Format:**
1. Model receives complex request
2. Model identifies sub-questions needed
3. Model asks sub-questions
4. User provides answers
5. Model synthesizes final output

**Use Cases:** Root cause analysis, complex debugging, multi-variable problems, system troubleshooting.

### Example Prompts

**JSON:**
\`\`\`json
{
  "problem": "My application is running slow",
  "verifier_questions": [
    "What is slow?",
    "When did it start?",
    "What changed?",
    "What is the stack?",
    "What have you tried?"
  ],
  "instruction": "Wait for answers, then diagnose root cause"
}
\`\`\`

**XML:**
\`\`\`xml
<problem>My application is running slow</problem>
<verifier_questions>
  <question>What is slow?</question>
  <question>When did it start?</question>
  <question>What changed?</question>
  <question>What is the stack?</question>
  <question>What have you tried?</question>
</verifier_questions>
<instruction>Wait for answers, then diagnose root cause</instruction>
\`\`\`

**Markdown:**
- **Problem:** My application is running slow
- **Verifier Questions:** What is slow? When did it start? What changed? What is the stack? What have you tried?
- **Instruction:** Wait for answers, then diagnose root cause`
}

// OUTPUT: Pure getter function
export function getCognitiveVerifierPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
