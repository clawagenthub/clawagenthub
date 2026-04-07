// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'co-star',
  name: 'CO-STAR (Context, Objective, Style, Tone, Audience, Response)',
  description: 'Professional communications and adaptive text generation. Use when output needs to match specific audience and communication style.',
  value: `**Description:** Professional communications and adaptive text generation. Use when output needs to match specific audience and communication style.

**Format:**
- Context: [Background situation, current state]
- Objective: [Specific goal to achieve]
- Style: [Writing style - formal, casual, technical]
- Tone: [Tone - persuasive, empathetic, authoritative]
- Audience: [Who will read this]
- Response: [Expected format and structure]

**Use Cases:** Business communications, marketing copy, technical documentation, stakeholder reports.

### Example Prompts

**JSON:**
\`\`\`json
{
  "context": "Our startup just launched a new project management tool",
  "objective": "Write a product announcement email to existing users",
  "style": "Professional but friendly",
  "tone": "Excited and value-focused",
  "audience": "Small business owners who use our basic planning tools",
  "response": "Email format with subject line, opening, 3 key features, closing"
}
\`\`\`

**XML:**
\`\`\`xml
<context>Our startup just launched a new project management tool</context>
<objective>Write a product announcement email to existing users</objective>
<style>Professional but friendly</style>
<tone>Excited and value-focused</tone>
<audience>Small business owners who use our basic planning tools</audience>
<response>Email format with subject line, opening, 3 key features, closing</response>
\`\`\`

**Markdown:**
- **Context:** Our startup just launched a new project management tool
- **Objective:** Write a product announcement email to existing users
- **Style:** Professional but friendly
- **Tone:** Excited and value-focused
- **Audience:** Small business owners who use our basic planning tools
- **Response:** Email format with subject line, opening, 3 key features, closing`
}

// OUTPUT: Pure getter function
export function getCoStarPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
