export interface DefaultPrompt {
  id: string
  name: string
  description: string
  value: string
}

// Default prompts from promt_comtext.md - full content with examples
export const DEFAULT_PROMPTS: DefaultPrompt[] = [
  {
    id: 'rtf',
    name: 'RTF (Role, Task, Format)',
    description: 'Simple framework for basic prompting with clear structure. Best for straightforward tasks where you need a specific output without complex reasoning.',
    value: `**Description:** Simple framework for basic prompting with clear structure. Best for straightforward tasks where you need a specific output without complex reasoning.

**Format:**
- Role: [Who the AI should act as]
- Task: [The specific action you want performed]
- Format: [How the output should be structured]

**Use Cases:** Writing simple emails, quick code snippets, basic Q&A, formatting existing content.

### Example Prompts

**JSON:**
\`\`\`json
{
  "role": "Senior Backend Engineer",
  "task": "Write a function to validate email addresses in JavaScript",
  "format": "Provide the code in a single code block with inline comments"
}
\`\`\`

**XML:**
\`\`\`xml
<role>Senior Backend Engineer</role>
<task>Write a function to validate email addresses in JavaScript</task>
<format>Provide the code in a single code block with inline comments</format>
\`\`\`

**Markdown:**
- **Role:** Senior Backend Engineer
- **Task:** Write a function to validate email addresses in JavaScript
- **Format:** Provide the code in a single code block with inline comments`
  },
  {
    id: 'race',
    name: 'RACE (Role, Action, Context, Expectation)',
    description: 'Adds expectation component to RTF for clearer success criteria. Use when you need specific quality standards or criteria met.',
    value: `**Description:** Adds expectation component to RTF for clearer success criteria. Use when you need specific quality standards or criteria met.

**Format:**
- Role: [Who the AI should act as]
- Action: [What specifically to do]
- Context: [Background information, situation]
- Expectation: [How to measure success, quality standards]

**Use Cases:** Code reviews with criteria, content with success metrics, technical specifications, performance evaluations.

### Example Prompts

**JSON:**
\`\`\`json
{
  "role": "Code Reviewer",
  "action": "Review the following function for security vulnerabilities",
  "context": "This function handles user authentication tokens",
  "expectation": "List vulnerabilities found, rate severity as Low/Medium/High, suggest fixes"
}
\`\`\`

**XML:**
\`\`\`xml
<role>Code Reviewer</role>
<action>Review the following function for security vulnerabilities</action>
<context>This function handles user authentication tokens</context>
<expectation>List vulnerabilities found, rate severity as Low/Medium/High, suggest fixes</expectation>
\`\`\`

**Markdown:**
- **Role:** Code Reviewer
- **Action:** Review the following function for security vulnerabilities
- **Context:** This function handles user authentication tokens
- **Expectation:** List vulnerabilities found, rate severity as Low/Medium/High, suggest fixes`
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: 'bab',
    name: 'BAB (Before, After, Bridge)',
    description: 'Persuasive storytelling approach. Use when you want to show transformation.',
    value: `**Description:** Persuasive storytelling approach. Use when you want to show transformation.

**Format:**
- Before: [Current situation - problem, pain, limitation]
- After: [Desired outcome - aspirational state]
- Bridge: [How to get from before to after]

**Use Cases:** Case studies, testimonials, brand storytelling, conversion pages, client proposals.

### Example Prompts

**JSON:**
\`\`\`json
{
  "before": "You spend hours every week manually entering data into spreadsheets. Errors pile up. Your team is frustrated.",
  "after": "Your data syncs automatically across all tools. Errors are eliminated. Your team focuses on insights, not data entry.",
  "bridge": "Our integration platform connects your existing tools and automates data flow. Setup takes 15 minutes, no coding required."
}
\`\`\`

**XML:**
\`\`\`xml
<before>You spend hours every week manually entering data into spreadsheets. Errors pile up. Your team is frustrated.</before>
<after>Your data syncs automatically across all tools. Errors are eliminated. Your team focuses on insights, not data entry.</after>
<bridge>Our integration platform connects your existing tools and automates data flow. Setup takes 15 minutes, no coding required.</bridge>
\`\`\`

**Markdown:**
- **Before:** You spend hours every week manually entering data into spreadsheets. Errors pile up. Your team is frustrated.
- **After:** Your data syncs automatically across all tools. Errors are eliminated. Your team focuses on insights, not data entry.
- **Bridge:** Our integration platform connects your existing tools and automates data flow. Setup takes 15 minutes, no coding required.`
  },
  {
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
  },
  {
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
  },
  {
    id: 'tree-of-thoughts',
    name: 'Tree of Thoughts',
    description: 'Branching reasoning for complex strategic exploration. Use when decision has multiple valid paths and consequences.',
    value: `**Description:** Branching reasoning for complex strategic exploration. Use when decision has multiple valid paths and consequences.

**Format:**
1. Define the problem clearly
2. Generate 3 distinct solution approaches
3. Evaluate each approach (sure/maybe/impossible)
4. Eliminate flawed approaches
5. Proceed with most robust, documenting reasoning

**Use Cases:** Architectural decisions, strategic planning, debugging, business decisions with tradeoffs.

### Example Prompts

**JSON:**
\`\`\`json
{
  "problem": "Need to reduce database query time from 3 seconds to under 500ms",
  "thoughts": [
    { "approach": "Add database index", "evaluation": "Maybe", "note": "Speeds reads but slows writes" },
    { "approach": "Implement caching layer", "evaluation": "Sure", "note": "Reduces load but adds complexity" },
    { "approach": "Denormalize database schema", "evaluation": "Maybe", "note": "Improves reads but complicates updates" }
  ],
  "decision": "Proceed with caching layer first, then evaluate indexing if needed"
}
\`\`\`

**XML:**
\`\`\`xml
<problem>Need to reduce database query time from 3 seconds to under 500ms</problem>
<thoughts>
  <thought evaluation="Maybe">
    <approach>Add database index</approach>
    <note>Speeds reads but slows writes</note>
  </thought>
  <thought evaluation="Sure">
    <approach>Implement caching layer</approach>
    <note>Reduces load but adds complexity</note>
  </thought>
  <thought evaluation="Maybe">
    <approach>Denormalize database schema</approach>
    <note>Improves reads but complicates updates</note>
  </thought>
</thoughts>
<decision>Proceed with caching layer first, then evaluate indexing if needed</decision>
\`\`\`

**Markdown:**
- **Problem:** Need to reduce database query time from 3 seconds to under 500ms
- **Thought 1:** Add database index - Evaluate: Maybe - Speeds reads but slows writes
- **Thought 2:** Implement caching layer - Evaluate: Sure - Reduces load but adds complexity
- **Thought 3:** Denormalize database schema - Evaluate: Maybe - Improves reads but complicates updates
- **Decision:** Proceed with caching layer first, then evaluate indexing if needed`
  },
  {
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
  },
  {
    id: 'self-consistency',
    name: 'Universal Self-Consistency',
    description: 'Ensemble method generating multiple responses then synthesizing. Use when you need high confidence.',
    value: `**Description:** Ensemble method generating multiple responses then synthesizing. Use when you need high confidence.

**Format:**
1. Generate 3 distinct responses to the same query
2. Evaluate all responses collectively
3. Select most accurate/relevant elements
4. Synthesize into final output
5. Include confidence score

**Use Cases:** Critical decisions, high-stakes content, technical accuracy, legal/compliance content.

### Example Prompts

**JSON:**
\`\`\`json
{
  "query": "Explain the tax implications of forming an LLC vs S-Corp",
  "steps": [
    "Generate 3 different explanations covering legal, financial, and practical angles",
    "Evaluate which elements are most accurate across all three",
    "Synthesize into single comprehensive answer with confidence score"
  ]
}
\`\`\`

**XML:**
\`\`\`xml
<query>Explain the tax implications of forming an LLC vs S-Corp</query>
<steps>
  <step>Generate 3 different explanations covering legal, financial, and practical angles</step>
  <step>Evaluate which elements are most accurate across all three</step>
  <step>Synthesize into single comprehensive answer with confidence score</step>
</steps>
\`\`\`

**Markdown:**
- **Query:** Explain the tax implications of forming an LLC vs S-Corp
- **Step 1:** Generate 3 different explanations covering legal, financial, and practical angles
- **Step 2:** Evaluate which elements are most accurate across all three
- **Step 3:** Synthesize into single comprehensive answer with confidence score`
  },
  {
    id: 'chain-of-density',
    name: 'Chain of Density',
    description: 'Iterative compression for high-entity-density summaries. Use when summarizing documents.',
    value: `**Description:** Iterative compression for high-entity-density summaries. Use when summarizing documents.

**Format:**
1. Generate initial sparse draft
2. Identify entities, facts, claims not yet included
3. Compress filler, fuse new entities into text
4. Repeat until density is ~0.15 entities per token
5. Never drop previously included entities

**Use Cases:** News article summaries, research paper abstracts, meeting notes, legal document summaries.

### Example Prompts

**JSON:**
\`\`\`json
{
  "source": "2000-word article about AI regulation in EU",
  "draft_1": "The EU has passed new AI regulations. These affect companies using AI. There are penalties for non-compliance.",
  "iteration_2": "Add EU AI Act, high-risk systems, €30 million fine, 2026 enforcement",
  "iteration_3": "Add specific sectors (healthcare, hiring, facial recognition), certification requirements",
  "final": "Dense summary with all key entities retained"
}
\`\`\`

**XML:**
\`\`\`xml
<source>2000-word article about AI regulation in EU</source>
<draft_1>The EU has passed new AI regulations. These affect companies using AI. There are penalties for non-compliance.</draft_1>
<iteration_2>Add EU AI Act, high-risk systems, €30 million fine, 2026 enforcement</iteration_2>
<iteration_3>Add specific sectors (healthcare, hiring, facial recognition), certification requirements</iteration_3>
<final>Dense summary with all key entities retained</final>
\`\`\`

**Markdown:**
- **Source:** 2000-word article about AI regulation in EU
- **Draft 1:** The EU has passed new AI regulations. These affect companies using AI. There are penalties for non-compliance.
- **Iteration 2:** Add "EU AI Act", "high-risk systems", "€30 million fine", "2026 enforcement"
- **Iteration 3:** Add specific sectors (healthcare, hiring, facial recognition), certification requirements
- **Final:** Dense summary with all key entities retained`
  },
  {
    id: 'chain-of-verification',
    name: 'Chain of Verification',
    description: 'Four-stage self-fact-checking pipeline. Use when accuracy is critical.',
    value: `**Description:** Four-stage self-fact-checking pipeline. Use when accuracy is critical.

**Format:**
1. Generate baseline draft response
2. Extract factual claims from draft
3. Generate verification questions for each claim
4. Answer questions independently (without referencing draft)
5. Compare answers to draft, correct unsupported claims
6. Produce final verified response

**Use Cases:** News reporting, technical documentation, legal content, medical information, financial advice.

### Example Prompts

**JSON:**
\`\`\`json
{
  "topic": "Explain how blockchain technology works",
  "draft": "Blockchain is a distributed ledger...",
  "verification": [
    "Is blockchain literally distributed?",
    "What does 'distributed' mean in this context?"
  ],
  "check": "Answer without reference to draft, verify against known facts",
  "final": "Corrected verified explanation"
}
\`\`\`

**XML:**
\`\`\`xml
<topic>Explain how blockchain technology works</topic>
<draft>Blockchain is a distributed ledger...</draft>
<verification>
  <question>Is blockchain literally distributed?</question>
  <question>What does 'distributed' mean in this context?</question>
</verification>
<check>Answer without reference to draft, verify against known facts</check>
<final>Corrected verified explanation</final>
\`\`\`

**Markdown:**
- **Topic:** Explain how blockchain technology works
- **Draft:** Blockchain is a distributed ledger...
- **Verification Questions:** Is blockchain literally distributed? What does "distributed" mean in this context?
- **Check:** Answer without reference to draft, verify against known facts
- **Final:** Corrected verified explanation`
  },
  {
    id: 'reflexion',
    name: 'Reflexion',
    description: 'Self-critique and recursive improvement loop. Use when you want quality improvement.',
    value: `**Description:** Self-critique and recursive improvement loop. Use when you want quality improvement.

**Format:**
1. Generate initial response
2. Define quality criteria to check against
3. Self-critique: What are weaknesses, blind spots, errors?
4. Generate improved version addressing critiques
5. (Optional) Repeat until satisfied

**Use Cases:** Code optimization, writing refinement, strategic plans, problem solutions.

### Example Prompts

**JSON:**
\`\`\`json
{
  "task": "Write a REST API design document",
  "self_critique": "Did I cover authentication? Are error responses defined? Is versioning addressed?",
  "improved": "Add OAuth2 section, define 4xx error codes, add /v1/ prefix to endpoints"
}
\`\`\`

**XML:**
\`\`\`xml
<task>Write a REST API design document</task>
<self_critique>Did I cover authentication? Are error responses defined? Is versioning addressed?</self_critique>
<improved>Add OAuth2 section, define 4xx error codes, add /v1/ prefix to endpoints</improved>
\`\`\`

**Markdown:**
- **Task:** Write a REST API design document
- **Self-critique:** Did I cover authentication? Are error responses defined? Is versioning addressed?
- **Improved:** Add OAuth2 section, define 4xx error codes, add /v1/ prefix to endpoints`
  },
  {
    id: 'flipped-interaction',
    name: 'Flipped Interaction Pattern',
    description: 'Model takes control to ask targeted questions. Use when you do not know what context is needed.',
    value: `**Description:** Model takes control to ask targeted questions. Use when you do not know what context is needed.

**Format:**
1. Define role and problem
2. Instruct model to ask N specific questions
3. Model asks questions one at a time
4. User answers each
5. Model synthesizes only after receiving answers

**Use Cases:** Diagnostic scenarios, consulting first meetings, troubleshooting, requirements gathering.

### Example Prompts

**JSON:**
\`\`\`json
{
  "role": "DevOps consultant",
  "task": "Help me optimize my deployment pipeline",
  "instruction": "Ask me up to 5 questions, one at a time, to understand my setup. Wait for my answer before asking next. Then provide recommendations."
}
\`\`\`

**XML:**
\`\`\`xml
<role>DevOps consultant</role>
<task>Help me optimize my deployment pipeline</task>
<instruction>Ask me up to 5 questions, one at a time, to understand my setup. Wait for my answer before asking next. Then provide recommendations.</instruction>
\`\`\`

**Markdown:**
- **Role:** DevOps consultant
- **Task:** Help me optimize my deployment pipeline
- **Instruction:** Ask me up to 5 questions, one at a time, to understand my setup. Wait for my answer before asking next. Then provide recommendations.`
  },
  {
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
  },
  {
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
  },
]

export function getPromptById(id: string): DefaultPrompt | undefined {
  return DEFAULT_PROMPTS.find((p) => p.id === id)
}

export function getPromptsByIds(ids: string[]): DefaultPrompt[] {
  return DEFAULT_PROMPTS.filter((p) => ids.includes(p.id))
}
