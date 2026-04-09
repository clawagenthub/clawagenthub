import type { Ticket, Status } from '@/lib/db/schema.js'
import type { BuildFlowPromptParams } from './flow-types.js'
import { getDatabase } from '@/lib/db/index.js'
import { DEFAULT_FLOW_TEMPLATE } from '@/lib/utils/flow-template.js'

/**
 * Check if a model has vision/multimodal capability
 */
export function modelHasVisionCapability(model: unknown): boolean {
  if (!model) return false

  let modelName: string
  if (typeof model === 'object' && model !== null) {
    const modelObj = model as Record<string, unknown>
    modelName = String(modelObj.id || modelObj.name || '')
  } else {
    modelName = String(model)
  }

  if (!modelName) return false
  const lowerModel = modelName.toLowerCase()
  const visionIndicators = [
    'vision', 'vl-', 'gpt-4v', 'gpt-4-vision', 'claude-3-opus',
    'claude-3-sonnet', 'claude-3-5', 'multimodal', 'gemma3',
    'pixtral', 'mistral-large', 'CommandR+'
  ]
  return visionIndicators.some(indicator => lowerModel.includes(indicator))
}

/**
 * Replace template variables with actual values
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\$${key}\\}`, 'g')
    result = result.replace(regex, value)
  }
  return result
}

/**
 * Build flow prompt for agent execution
 */
export function buildFlowPrompt(params: BuildFlowPromptParams): string {
  const { ticket, currentStatus, agentId, statusInstructions, recentComments, workspaceId, hasVisionCapability, sessionToken } = params
  const db = getDatabase()

  const customTemplateSetting = db.prepare(
    'SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?'
  ).get(workspaceId, 'flow_prompt_template') as { setting_value: string | null } | undefined

  const template = customTemplateSetting?.setting_value || DEFAULT_FLOW_TEMPLATE

  const skills = db.prepare(`
    SELECT s.id, s.skill_name, s.skill_description
    FROM status_skills ss
    JOIN skills s ON ss.skill_id = s.id
    WHERE ss.status_id = ? AND s.workspace_id = ? AND s.is_active = 1
    ORDER BY ss.priority ASC
  `).all(currentStatus.id, workspaceId) as Array<{
    id: string
    skill_name: string
    skill_description: string | null
  }>

  let skillsSection = ''
  if (skills.length > 0) {
    skillsSection = JSON.stringify(
      skills.map(skill => ({
        id: skill.id,
        name: skill.skill_name,
        description: skill.skill_description || ''
      })),
      null,
      2
    )
  } else {
    skillsSection = '[]'
  }

  // Add role-based user attribution to comments
  const commentsWithRole = recentComments.map((comment) => {
    // Check if comment is from an agent using is_agent_completion_signal (1 = agent, 0 = user)
    // Fallback to content-based detection if is_agent_completion_signal is not available
    const isAgentComment =
      (comment as any).is_agent_completion_signal === 1 ||
      comment.content.startsWith('[Agent ')
    let userAttribution: string
    if (isAgentComment) {
      // Extract agent name from comment content like "[Agent librarian] Status=..."
      const match = comment.content.match(/^\[Agent\s+([^\]]+)\]/)
      const agentName = match ? match[1] : 'Unknown'
      userAttribution = `user:${agentName}-AI`
    } else {
      // User comment - use email
      userAttribution = `user:${comment.email || 'unknown'}-user`
    }
    return {
      ...comment,
      user: userAttribution,
    }
  })
  const commentsJson = JSON.stringify(commentsWithRole, null, 2)
  const ticketJson = JSON.stringify({
    ...ticket,
    description: null,
    task_todo: ticket.description
  }, null, 2)

  const variables = {
    ticketId: ticket.id,
    ticketNumber: String(ticket.ticket_number),
    ticketTitle: ticket.title,
    ticketDescription: ticket.description || 'No description',
    currentStatusId: currentStatus.id,
    currentStatusName: currentStatus.name,
    currentStatusDescription: currentStatus.description || 'No status description provided.',
    agentId: agentId,
    statusInstructions: statusInstructions || 'No extra instructions provided.',
    commentsJson: commentsJson,
    ticketJson: ticketJson,
    workspaceId: workspaceId,
    skills: skillsSection,
    tempPath: '/tmp',
    domain: process.env.BASE_URL || 'http://localhost:7777',
    sessionToken: sessionToken,
  }

  const prompt = replaceTemplateVariables(template, variables)
  return prompt
}
