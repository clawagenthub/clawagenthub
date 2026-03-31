// Centralized query keys for type safety and consistency
export const queryKeys = {
  user: {
    me: ['user', 'me'] as const,
  },
  gateways: {
    all: ['gateways'] as const,
    detail: (id: string) => ['gateways', id] as const,
  },
  workspaces: {
    all: ['workspaces'] as const,
    current: ['workspaces', 'current'] as const,
  },
} as const
