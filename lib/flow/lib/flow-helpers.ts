import type { BuildFlowPromptParams } from './flow-types.js'
import { getDatabase, getProjectById } from '@/lib/db/index.js'
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
    'vision',
    'vl-',
    'gpt-4v',
    'gpt-4-vision',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-5',
    'multimodal',
    'gemma3',
    'pixtral',
    'mistral-large',
    'CommandR+',
  ]
  return visionIndicators.some((indicator) => lowerModel.includes(indicator))
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
  const {
    ticket,
    currentStatus,
    agentId,
    statusInstructions,
    recentComments,
    workspaceId,
    sessionToken,
  } = params
  const db = getDatabase()

  const customTemplateSetting = db
    .prepare(
      'SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?'
    )
    .get(workspaceId, 'flow_prompt_template') as
    | { setting_value: string | null }
    | undefined

  const template = customTemplateSetting?.setting_value || DEFAULT_FLOW_TEMPLATE

  // Get temp_path from workspace_settings, fallback to '/tmp'
  const tempPathSetting = db
    .prepare(
      'SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?'
    )
    .get(workspaceId, 'temp_path') as
    | { setting_value: string | null }
    | undefined

  const tempPath = tempPathSetting?.setting_value || '/tmp'

  const skills = db
    .prepare(
      `
    SELECT s.id, s.skill_name, s.skill_description
    FROM status_skills ss
    JOIN skills s ON ss.skill_id = s.id
    WHERE ss.status_id = ? AND s.workspace_id = ? AND s.is_active = 1
    ORDER BY ss.priority ASC
  `
    )
    .all(currentStatus.id, workspaceId) as Array<{
    id: string
    skill_name: string
    skill_description: string | null
  }>

  let skillsSection = ''
  if (skills.length > 0) {
    skillsSection = JSON.stringify(
      skills.map((skill) => ({
        id: skill.id,
        name: skill.skill_name,
        description: skill.skill_description || '',
      })),
      null,
      2
    )
  } else {
    skillsSection = '[]'
  }

  const statuses = db
    .prepare(
      `
    SELECT id, name, priority, is_flow_included, agent_id, on_failed_goto, ask_approve_to_continue
    FROM statuses
    WHERE workspace_id = ?
    ORDER BY priority ASC, name ASC
  `
    )
    .all(workspaceId) as Array<{
    id: string
    name: string
    priority: number
    is_flow_included: number | boolean
    agent_id: string | null
    on_failed_goto: string | null
    ask_approve_to_continue: number | boolean
  }>

  const statusesSection = JSON.stringify(
    statuses.map((status) => ({
      id: status.id,
      name: status.name,
      priority: status.priority,
      flow_default_enabled: Boolean(status.is_flow_included),
      default_agent_id: status.agent_id,
      on_failed_goto: status.on_failed_goto,
      ask_approve_to_continue: Boolean(status.ask_approve_to_continue),
    })),
    null,
    2
  )

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

  // Fetch selected project if ticket has project_id
  let selectedProject: { name: string; description: string | null; value: string | null } | null = null
  if (ticket.project_id) {
    const project = getProjectById(db, ticket.project_id)
    if (project) {
      selectedProject = {
        name: project.name,
        description: project.description,
        value: project.value,
      }
    }
  }

  const ticketJson = JSON.stringify(
    {
      ...ticket,
      description: null,
      task_todo: ticket.description,
      selectedProject,
    },
    null,
    2
  )

  const variables = {
    ticketId: ticket.id,
    ticketNumber: String(ticket.ticket_number),
    ticketTitle: ticket.title,
    ticketDescription: ticket.description || 'No description',
    currentStatusId: currentStatus.id,
    currentStatusName: currentStatus.name,
    currentStatusDescription:
      currentStatus.description || 'No status description provided.',
    agentId: agentId,
    statusInstructions: statusInstructions || 'No extra instructions provided.',
    commentsJson: commentsJson,
    ticketJson: ticketJson,
    workspaceId: workspaceId,
    skills: skillsSection,
    statuses: statusesSection,
    tempPath: tempPath,
    domain: process.env.BASE_URL || 'http://localhost:7777',
    sessionToken: sessionToken,
  }

  const prompt = replaceTemplateVariables(template, variables)
  return prompt
}
