import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import { getGatewayManager } from '@/lib/gateway/manager'
import { buildAutoTicketConverterPrompt } from '@/lib/utils/prompts/autoTicketConverterPrompt'
import { buildSelectedTicketConverterPrompt } from '@/lib/utils/prompts/selectedTicketConverterPrompt'
import { DEFAULT_PROMPTS } from '@/lib/utils/prompts'
import { findClientForAgent } from '@/app/api/tickets/[ticketId]/flow/lib/find-client'
import logger from "@/lib/logger/index.js"


function extractResponseText(response: any): string {
  const message = response?.message ?? response
  const content = message?.content

  if (typeof content === 'string') return content.trim()
  if (typeof message === 'string') return message.trim()

  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block?.type === 'text' && typeof block?.text === 'string')
      .map((block: any) => block.text)
      .join('\n')
      .trim()
  }

  if (typeof message?.text === 'string') return message.text.trim()
  return ''
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase()

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value
    if (!sessionToken) {
      return NextResponse.json({ message: 'Unauthorized - No session found' }, { status: 401 })
    }

    const user = getUserFromSession(sessionToken)
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized - Invalid session' }, { status: 401 })
    }

    const body = await request.json()
    const { ticketId, mode, targetText, selectedFormat } = body as {
      ticketId?: string
      mode?: 'auto' | 'selected'
      targetText?: string
      selectedFormat?: { name: string; description: string }
    }

    if (!targetText?.trim()) {
      return NextResponse.json({ message: 'targetText is required' }, { status: 400 })
    }

    const db = getDatabase()
    const session = db.prepare('SELECT current_workspace_id FROM sessions WHERE token = ?').get(sessionToken) as { current_workspace_id: string | null } | undefined
    if (!session?.current_workspace_id) {
      return NextResponse.json({ message: 'No workspace selected' }, { status: 400 })
    }

    const workspaceId = session.current_workspace_id

    const member = db.prepare('SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, user.id) as { id: string } | undefined
    if (!member) {
      return NextResponse.json({ message: 'Not a member of this workspace' }, { status: 403 })
    }

    if (ticketId) {
      const ticket = db.prepare('SELECT id FROM tickets WHERE id = ? AND workspace_id = ?').get(ticketId, workspaceId) as { id: string } | undefined
      if (!ticket) {
        return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
      }
    }

    const settingsRows = db.prepare('SELECT setting_key, setting_value FROM workspace_settings WHERE workspace_id = ?').all(workspaceId) as Array<{ setting_key: string; setting_value: string | null }>
    const settings = Object.fromEntries(settingsRows.map((row) => [row.setting_key, row.setting_value])) as Record<string, string | null>

    const promptConverterAgentId = settings.prompt_converter_agent_id || null
    const promptConverterGatewayId = settings.prompt_converter_gateway_id || null
    const autoPromptTemplate = settings.auto_prompt_template || undefined
    const selectedPromptTemplate = settings.selected_prompt_template || undefined

    let effectiveAgentId = promptConverterAgentId
    let effectiveGatewayId = promptConverterGatewayId

    if (!effectiveAgentId || !effectiveGatewayId) {
      const userSettings = db.prepare('SELECT summarizer_agent_id, summarizer_gateway_id FROM user_settings WHERE user_id = ?').get(user.id) as { summarizer_agent_id: string | null; summarizer_gateway_id: string | null } | undefined
      effectiveAgentId = effectiveAgentId || userSettings?.summarizer_agent_id || null
      effectiveGatewayId = effectiveGatewayId || userSettings?.summarizer_gateway_id || null
    }

    if (!effectiveAgentId) {
      return NextResponse.json({ message: 'No prompt converter agent configured. Please select one in Settings → Prompt Templates.' }, { status: 400 })
    }

    const manager = getGatewayManager()
    let client = effectiveGatewayId ? manager.getClient(effectiveGatewayId) : undefined

    if ((!client || !client.isConnected()) && effectiveAgentId) {
      const match = await findClientForAgent(workspaceId, effectiveAgentId)
      if (match) {
        client = match.client
        effectiveGatewayId = match.gatewayId
      }
    }

    if (!client || !client.isConnected()) {
      return NextResponse.json({ message: 'Prompt converter agent gateway is not connected' }, { status: 503 })
    }

    let prompt: string
    if (mode === 'selected') {
      if (!selectedFormat?.name?.trim()) {
        return NextResponse.json({ message: 'selectedFormat is required for selected mode' }, { status: 400 })
      }
      prompt = buildSelectedTicketConverterPrompt(
        {
          targetText: targetText.trim(),
          selectedFormat: {
            name: selectedFormat.name,
            description: selectedFormat.description || '',
          },
        },
        selectedPromptTemplate
      )
    } else {
      // Get prompts from workspace_settings table (key: workspace_prompts)
      // This is stored as JSON, not as a separate database table
      const workspacePromptsJson = settings.workspace_prompts || null
      let promptFormats: Array<{ name: string; description: string; value: string }> = []

      if (workspacePromptsJson) {
        try {
          const parsed = JSON.parse(workspacePromptsJson) as Array<{ name: string; description: string; value: string }>
          promptFormats = parsed.map((p) => ({ name: p.name, description: p.description || '', value: p.value || '' }))
        } catch {
          promptFormats = []
        }
      }

      // Fall back to DEFAULT_PROMPTS if no custom prompts set
      if (promptFormats.length === 0) {
        promptFormats = DEFAULT_PROMPTS.map((p) => ({ name: p.name, description: p.description, value: p.value }))
      }

      prompt = buildAutoTicketConverterPrompt(
        {
          targetText: targetText.trim(),
          promptFormats,
        },
        autoPromptTemplate
      )
    }

    // Generate new UUID session for each auto-prompt request (like status flow does)
    const newSessionId = randomUUID()
    const agentSessionKey = `agent:${effectiveAgentId}:${newSessionId}`
    
    // Create session in database for history tracking
    const now = new Date().toISOString()
    const agentName = client.getAgentName?.() || 'Prompt Converter'
    db.prepare(`
      INSERT INTO chat_sessions (
        id, workspace_id, user_id, gateway_id, agent_id, agent_name,
        session_key, status, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newSessionId,
      workspaceId,
      user.id,
      effectiveGatewayId,
      effectiveAgentId,
      agentName,
      agentSessionKey,
      'idle',
      now,
      now,
      now
    )
    
    const response = await client.sendChatMessageAndWait(agentSessionKey, prompt)

    if (response.error) {
      return NextResponse.json({ message: response.error }, { status: 502 })
    }

    const convertedText = extractResponseText(response)
    if (!convertedText) {
      return NextResponse.json({ message: 'Agent returned an empty response' }, { status: 502 })
    }

    return NextResponse.json({ convertedText, prompt, agentId: effectiveAgentId, gatewayId: effectiveGatewayId })
  } catch (error) {
    logger.error('[Ticket Prompt Convert API] Error:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
