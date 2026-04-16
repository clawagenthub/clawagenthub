'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  clearIdentityContext as clearLoggerIdentityContext,
  setIdentityContext as setLoggerIdentityContext,
  type IdentityFields,
} from '@/lib/logging/identity-logger.js'

const IDENTITY_STORAGE_KEY = 'clawhub.active-identity-id'

export interface IdentityContextValue {
  identity: IdentityFields | null
  activeIdentityId: string | null
  defaultIdentity: IdentityFields | null
  isLoading: boolean
  error: string | null
  setIdentity: (identity: IdentityFields | null) => void
  clearIdentity: () => void
  switchIdentity: (identityId: string) => Promise<IdentityFields | null>
  refreshIdentity: () => Promise<IdentityFields | null>
  handleIdentityExpiry: () => Promise<IdentityFields | null>
}

export interface IdentityProviderProps {
  children: ReactNode
  sessionId?: string | null
  defaultIdentity?: IdentityFields | null
  storageKey?: string
  onIdentityExpired?: () => void
}

const IdentityContext = createContext<IdentityContextValue | null>(null)

function toIdentityFields(identity: Partial<IdentityFields> | null | undefined): IdentityFields | null {
  if (!identity?.identity_id || !identity?.identity_name) {
    return null
  }

  return {
    identity_id: identity.identity_id,
    identity_name: identity.identity_name,
    email: identity.email ?? null,
  }
}

async function readIdentity(
  sessionId: string,
  identityId: string
): Promise<IdentityFields | null> {
  const response = await fetch(`/api/${sessionId}/identities/${identityId}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Identity-ID': identityId,
    },
  })

  if (!response.ok) {
    const error = new Error(`Failed to load identity (${response.status})`)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }

  const data = await response.json()
  const identity = data.identity ?? data.identities?.[0]

  return identity
    ? {
        identity_id: identity.id,
        identity_name: identity.name,
        email: identity.email ?? null,
      }
    : null
}

async function performSwitch(
  sessionId: string,
  identityId: string
): Promise<IdentityFields | null> {
  const response = await fetch(`/api/${sessionId}/identities/${identityId}/switch`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Identity-ID': identityId,
    },
  })

  if (!response.ok) {
    const error = new Error(`Failed to switch identity (${response.status})`)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }

  const data = await response.json()
  const identity = data.identity

  return identity
    ? {
        identity_id: identity.id,
        identity_name: identity.name,
        email: identity.email ?? null,
      }
    : readIdentity(sessionId, identityId)
}

export function IdentityProvider({
  children,
  sessionId = null,
  defaultIdentity = null,
  storageKey = IDENTITY_STORAGE_KEY,
  onIdentityExpired,
}: IdentityProviderProps) {
  const [identity, setIdentityState] = useState<IdentityFields | null>(
    toIdentityFields(defaultIdentity)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultIdentityRef = useRef<IdentityFields | null>(
    toIdentityFields(defaultIdentity)
  )

  useEffect(() => {
    defaultIdentityRef.current = toIdentityFields(defaultIdentity)
  }, [defaultIdentity])

  useEffect(() => {
    if (identity) {
      setLoggerIdentityContext(identity)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(storageKey, identity.identity_id)
      }
      return
    }

    clearLoggerIdentityContext()
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(storageKey)
    }
  }, [identity, storageKey])

  const setIdentity = useCallback((nextIdentity: IdentityFields | null) => {
    setIdentityState(toIdentityFields(nextIdentity))
    setError(null)
  }, [])

  const clearIdentity = useCallback(() => {
    setIdentityState(null)
    setError(null)
  }, [])

  const switchIdentity = useCallback(
    async (identityId: string) => {
      if (!sessionId) {
        throw new Error('Session id required for identity switching')
      }

      setIsLoading(true)
      setError(null)

      try {
        const nextIdentity = await performSwitch(sessionId, identityId)
        setIdentityState(nextIdentity)
        return nextIdentity
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to switch identity'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId]
  )

  const handleIdentityExpiry = useCallback(async () => {
    const fallbackIdentity = defaultIdentityRef.current

    clearLoggerIdentityContext()
    onIdentityExpired?.()

    if (!fallbackIdentity || !sessionId) {
      setIdentityState(null)
      return null
    }

    try {
      const refreshedIdentity = await performSwitch(
        sessionId,
        fallbackIdentity.identity_id
      )
      setIdentityState(refreshedIdentity)
      setError(null)
      return refreshedIdentity
    } catch (err) {
      setIdentityState(null)
      setError(
        err instanceof Error ? err.message : 'Identity session expired'
      )
      return null
    }
  }, [onIdentityExpired, sessionId])

  const refreshIdentity = useCallback(async () => {
    if (!sessionId || !identity?.identity_id) {
      return identity
    }

    setIsLoading(true)

    try {
      const refreshed = await readIdentity(sessionId, identity.identity_id)
      setIdentityState(refreshed)
      setError(null)
      return refreshed
    } catch (err) {
      const status =
        err instanceof Error && 'status' in err
          ? Number((err as Error & { status?: number }).status)
          : undefined

      if (status === 401 || status === 403 || status === 404 || status === 410) {
        return handleIdentityExpiry()
      }

      const message = err instanceof Error ? err.message : 'Failed to refresh identity'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [handleIdentityExpiry, identity, sessionId])

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') {
      return
    }

    const storedIdentityId = window.sessionStorage.getItem(storageKey)
    if (!storedIdentityId) {
      return
    }

    if (identity?.identity_id === storedIdentityId) {
      return
    }

    void readIdentity(sessionId, storedIdentityId)
      .then((storedIdentity) => {
        if (storedIdentity) {
          setIdentityState(storedIdentity)
        }
      })
      .catch(() => {
        window.sessionStorage.removeItem(storageKey)
      })
  }, [identity?.identity_id, sessionId, storageKey])

  const value = useMemo<IdentityContextValue>(
    () => ({
      identity,
      activeIdentityId: identity?.identity_id ?? null,
      defaultIdentity: defaultIdentityRef.current,
      isLoading,
      error,
      setIdentity,
      clearIdentity,
      switchIdentity,
      refreshIdentity,
      handleIdentityExpiry,
    }),
    [error, handleIdentityExpiry, identity, isLoading, refreshIdentity, setIdentity, clearIdentity, switchIdentity]
  )

  return (
    <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
  )
}

export function useIdentityContext(): IdentityContextValue {
  const context = useContext(IdentityContext)

  if (!context) {
    throw new Error('useIdentityContext must be used within IdentityProvider')
  }

  return context
}

export type { IdentityFields }
