import { useEffect, useRef, useState } from 'react'
import { useGenerateSessionSummary } from '@/lib/query/hooks/useChat'
import { useUserSettings } from '@/lib/query/hooks/useUserSettings'
import logger, { logCategories } from '@/lib/logger/index.js'


interface UseSessionIdleOptions {
  sessionId: string | null
  sessionStatus: 'active' | 'idle' | 'inactive' | undefined
  enabled?: boolean
}

export function useSessionIdle({
  sessionId,
  sessionStatus,
  enabled = true,
}: UseSessionIdleOptions) {
  const generateSummary = useGenerateSessionSummary()
  const { data: userSettings } = useUserSettings()
  const [isIdle, setIsIdle] = useState(false)
  const lastActivityRef = useRef(Date.now())
  const hasTriggeredRef = useRef(false)

  // Get idle timeout from user settings (in minutes)
  const idleTimeoutMinutes = userSettings?.idle_timeout_minutes ?? 2
  const idleTimeoutMs = idleTimeoutMinutes * 60 * 1000

  // Reset activity tracker
  const resetActivity = () => {
    lastActivityRef.current = Date.now()
    hasTriggeredRef.current = false
    setIsIdle(false)
  }

  useEffect(() => {
    // Clear any existing timer on unmount

    // Only run if session exists, settings are loaded, and auto-summary is enabled
    // We check if session is NOT already inactive (summarized sessions shouldn't be re-summarized)
    if (
      !enabled ||
      !sessionId ||
      sessionStatus === 'inactive' ||
      !userSettings?.auto_summary_enabled ||
      !userSettings?.summarizer_agent_id
    ) {
      return
    }

    // Check if we should trigger summary
    const checkIdle = () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current

      if (timeSinceActivity >= idleTimeoutMs && !hasTriggeredRef.current) {
        setIsIdle(true)
        hasTriggeredRef.current = true

        // Trigger summary generation
        generateSummary.mutate(sessionId, {
          onSuccess: () => {
            logger.debug({ category: logCategories.SESSION_STATUS }, '[useSessionIdle] Summary generated successfully')
          },
          onError: (error) => {
            logger.error('[useSessionIdle] Failed to generate summary:', error)
          },
        })
      }
    }

    // Set up interval to check idle status
    const intervalId = setInterval(checkIdle, 5000) // Check every 5 seconds

    return () => {
      clearInterval(intervalId)
    }
  }, [
    sessionId,
    sessionStatus,
    enabled,
    idleTimeoutMs,
    userSettings?.auto_summary_enabled,
    userSettings?.summarizer_agent_id,
    generateSummary,
  ])

  return {
    isIdle,
    resetActivity,
    isGenerating: generateSummary.isPending,
  }
}
