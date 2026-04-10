'use client'

// Theme Context - Internal context object
// This file exists to satisfy react-refresh/only-export-components rule
// by separating the Context object from component exports

import React from 'react'
import { ThemeContextType } from '@/lib/types/theme-types'

export const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined
)
