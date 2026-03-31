'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'blue' | 'black-red'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('clawhub-theme') as Theme
    if (savedTheme && ['light', 'dark', 'blue', 'black-red'].includes(savedTheme)) {
      setThemeState(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
      // Apply theme to body element
      document.body.style.backgroundColor = `rgb(var(--bg-primary))`
      document.body.style.color = `rgb(var(--text-primary))`
    } else {
      // Apply default theme to body
      document.body.style.backgroundColor = `rgb(var(--bg-primary))`
      document.body.style.color = `rgb(var(--text-primary))`
    }
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('clawhub-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    // Apply theme to body element immediately
    document.body.style.backgroundColor = `rgb(var(--bg-primary))`
    document.body.style.color = `rgb(var(--text-primary))`
  }

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
