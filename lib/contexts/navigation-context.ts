// Navigation Context - Internal context object
// This file exists to satisfy react-refresh/only-export-components rule
// by separating the Context object from component exports

import { NavigationContextValue } from '@/lib/types/navigation-types'
import { createContext } from 'react'

export const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)
