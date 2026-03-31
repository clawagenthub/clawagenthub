'use client'

import { useAtom, useAtomValue } from 'jotai'
import { 
  gatewaysAtom, 
  gatewayCountAtom, 
  connectedGatewaysAtom,
  gatewaysLoadingAtom 
} from '../atoms/gatewaysAtom'

/**
 * Hook to access gateways data with manual refresh capability
 * 
 * This hook:
 * - Fetches gateways data on mount
 * - Provides derived states (count, connected gateways)
 * - Allows manual refresh after CRUD operations
 * - Manages loading state
 * 
 * Unlike user data, gateways are refreshed on-demand rather than automatically
 * because they change less frequently and only through user actions.
 */
export function useGateways() {
  const [gateways, refreshGateways] = useAtom(gatewaysAtom)
  const gatewayCount = useAtomValue(gatewayCountAtom)
  const connectedGateways = useAtomValue(connectedGatewaysAtom)
  const [loading, setLoading] = useAtom(gatewaysLoadingAtom)

  /**
   * Wrapper to refresh gateways with loading state management
   * Call this after adding, updating, or deleting gateways
   */
  const refresh = async () => {
    setLoading(true)
    try {
      await refreshGateways()
    } finally {
      setLoading(false)
    }
  }

  return {
    gateways,
    gatewayCount,
    connectedGateways,
    loading,
    refresh,
  }
}

/**
 * Lightweight hook for components that only need to trigger gateway refresh
 * without subscribing to gateway data changes
 */
export function useRefreshGateways() {
  const [, refreshGateways] = useAtom(gatewaysAtom)
  return refreshGateways
}
