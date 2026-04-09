// Theme Context - Internal context object
// This file exists to satisfy react-refresh/only-export-components rule
// by separating the Context object from component exports

import { ThemeContextType } from '@/lib/types/theme-types'
import { createContext } from 'react'

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
