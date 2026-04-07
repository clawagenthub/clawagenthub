// INPUT: Interface
import type { DefaultPrompt } from './types'

// LOGIC: Template data constant
const PROMPT_DATA: DefaultPrompt = {
  id: 'fab',
  name: 'FAB (Features, Advantages, Benefits)',
  description: 'Sales-focused presentation structure. Use when selling products or services.',
  value: `**Description:** Sales-focused presentation structure. Use when selling products or services.

**Format:**
- Features: [What the product/service has or does]
- Advantages: [How the feature works - practical benefits]
- Benefits: [Why it matters - emotional/value outcome]

**Use Cases:** Product descriptions, sales presentations, e-commerce listings, pitch decks.

### Example Prompts

**JSON:**
\`\`\`json
{
  "feature": "Solar-powered battery bank with 20,000mAh capacity",
  "advantage": "Charges automatically in sunlight and can power a laptop for 12 hours",
  "benefit": "Never be stranded with a dead device again. Work from anywhere without hunting for outlets."
}
\`\`\`

**XML:**
\`\`\`xml
<feature>Solar-powered battery bank with 20,000mAh capacity</feature>
<advantage>Charges automatically in sunlight and can power a laptop for 12 hours</advantage>
<benefit>Never be stranded with a dead device again. Work from anywhere without hunting for outlets.</benefit>
\`\`\`

**Markdown:**
- **Feature:** Solar-powered battery bank with 20,000mAh capacity
- **Advantage:** Charges automatically in sunlight and can power a laptop for 12 hours
- **Benefit:** Never be stranded with a dead device again. Work from anywhere without hunting for outlets.`
}

// OUTPUT: Pure getter function
export function getFabPrompt(): DefaultPrompt {
  return PROMPT_DATA
}
