/**
 * Extract text from nested value structures
 */
export function extractText(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((v) => extractText(v, depth + 1)).filter(Boolean).join('\n')
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>
    const priority = ['message', 'content', 'text', 'output', 'result', 'data']
    for (const key of priority) {
      if (key in rec) {
        const out = extractText(rec[key], depth + 1)
        if (out) return out
      }
    }
    return Object.values(rec).map((v) => extractText(v, depth + 1)).filter(Boolean).join('\n')
  }
  return ''
}

/**
 * Parse agent flow result from raw text response
 */
export function parseAgentFlowResult(rawText: string): {
  result: 'finished' | 'failed' | 'pause'
  notes: string
  progressComment: string
} {
  const text = rawText.trim()
  if (!text) {
    return {
      result: 'finished',
      notes: 'Agent completed with empty response.',
      progressComment: 'Agent completed the task.',
    }
  }

  try {
    const parsed = JSON.parse(text) as {
      result?: string
      decision?: string
      action?: string
      notes?: string
      final_summary?: string
      comment?: string
      progress_comment?: string
    }

    const normalizedResult = (parsed.result || parsed.decision || parsed.action || '').toLowerCase()
    const progressComment =
      parsed.progress_comment ||
      parsed.comment ||
      parsed.notes ||
      parsed.final_summary ||
      'No progress comment provided by agent.'
    const notes = parsed.final_summary || parsed.notes || parsed.comment || text

    if (normalizedResult === 'failed') {
      return { result: 'failed', notes, progressComment }
    }
    if (normalizedResult === 'finished') {
      return { result: 'finished', notes, progressComment }
    }
    if (normalizedResult === 'pause' || normalizedResult === 'waiting') {
      return { result: 'pause', notes, progressComment }
    }
  } catch {
    // ignore parse errors and continue with text heuristics
  }

  const marker = (label: string) => {
    const rx = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'im')
    const m = text.match(rx)
    return m?.[1]?.trim() || ''
  }
  const markerResult = marker('result') || marker('decision') || marker('action')
  const markerComment = marker('comment') || marker('progress_comment')
  const markerNotes = marker('notes') || marker('summary')

  if (markerResult) {
    const normalized = markerResult.toLowerCase()
    const result: 'finished' | 'failed' | 'pause' =
      normalized.includes('fail') ? 'failed' : normalized.includes('pause') || normalized.includes('wait') ? 'pause' : 'finished'
    return {
      result,
      notes: markerNotes || markerComment || text,
      progressComment: markerComment || markerNotes || text,
    }
  }

  if (/\b(result|decision|action|flow_result)\s*:\s*(pause|waiting)\b/i.test(text) || /\bpause(d)?\b/i.test(text)) {
    return {
      result: 'pause',
      notes: text,
      progressComment: text,
    }
  }

  if (/\b(result|flow_result)\s*:\s*failed\b/i.test(text) || /\bfailed\b/i.test(text)) {
    return { result: 'failed', notes: text, progressComment: text }
  }

  return { result: 'finished', notes: text, progressComment: text }
}
