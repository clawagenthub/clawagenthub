'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'
import type { Gateway } from '@/lib/db/schema'

async function fetchGateways(): Promise<Gateway[]> {
  const response = await fetch('/api/gateways', {
    credentials: 'include',
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch gateways')
  }
  
  const data = await response.json()
  return data.gateways || []
}

export function useGateways() {
  const query = useQuery({
    queryKey: queryKeys.gateways.all,
    queryFn: fetchGateways,
    // Don't auto-refetch gateways as frequently as user data
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    gateways: query.data ?? [],
    gatewayCount: query.data?.length ?? 0,
    connectedGateways: query.data?.filter(g => g.status === 'connected') ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: query.refetch,
  }
}

// Add Gateway Mutation
interface AddGatewayData {
  name: string
  pairingCode: string
}

async function addGateway(data: AddGatewayData): Promise<Gateway> {
  const response = await fetch('/api/gateways/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to add gateway')
  }
  
  return response.json()
}

export function useAddGateway() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: addGateway,
    onSuccess: () => {
      // Refetch gateways list after adding
      queryClient.invalidateQueries({ queryKey: queryKeys.gateways.all })
    },
  })
}
