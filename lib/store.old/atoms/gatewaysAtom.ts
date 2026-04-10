import { atom } from 'jotai'
import { atomWithRefresh } from 'jotai/utils'
import type { Gateway } from '@/lib/db/schema'
import logger from '@/lib/logger/index.js'


/**
 * Base atom that fetches gateways data from /api/gateways
 * This atom uses atomWithRefresh to allow manual refresh after CRUD operations
 */
export const gatewaysAtom = atomWithRefresh(async (_get) => {
  try {
    const response = await fetch('/api/gateways')
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    return (data.gateways || []) as Gateway[]
  } catch (error) {
    logger.error('[gatewaysAtom] Error fetching gateways:', error)
    return []
  }
})

/**
 * Derived atom for gateway count
 * Since gatewaysAtom is async, this must also be async
 */
export const gatewayCountAtom = atom(async (get) => {
  const gateways = await get(gatewaysAtom)
  return gateways.length
})

/**
 * Derived atom for connected gateways only
 */
export const connectedGatewaysAtom = atom(async (get) => {
  const gateways = await get(gatewaysAtom)
  return gateways.filter((g) => g.status === 'connected')
})

/**
 * Loading state atom for gateways operations
 */
export const gatewaysLoadingAtom = atom(false)
