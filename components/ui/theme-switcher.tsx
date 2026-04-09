'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/lib/hooks/use-theme'
import { type Theme } from '@/lib/types/theme-types'

interface ThemeOption {
  id: Theme
  name: string
  icon: string
  colors: {
    primary: string
    secondary: string
    accent: string
  }
}

const themes: ThemeOption[] = [
  {
    id: 'light',
    name: 'Light Mode',
    icon: '☀️',
    colors: {
      primary: '#ffffff',
      secondary: '#f9fafb',
      accent: '#3b82f6',
    },
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    icon: '🌙',
    colors: {
      primary: '#111827',
      secondary: '#1f2937',
      accent: '#60a5fa',
    },
  },
  {
    id: 'blue',
    name: 'Blue Mode',
    icon: '💙',
    colors: {
      primary: '#eff6ff',
      secondary: '#dbeafe',
      accent: '#2563eb',
    },
  },
  {
    id: 'black-red',
    name: 'Black Red Mode',
    icon: '🔴',
    colors: {
      primary: '#0f0f0f',
      secondary: '#1e1e1e',
      accent: '#ef4444',
    },
  },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    setIsOpen(false)
  }

  const currentTheme = themes.find((t) => t.id === theme) || themes[0]

  return (
    <div className="relative" ref={popupRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
        style={{
          backgroundColor: `rgb(var(--sidebar-hover))`,
        }}
        title="Change Theme"
        aria-label="Change Theme"
      >
        <span className="text-xl">{currentTheme.icon}</span>
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-64 rounded-lg shadow-xl border overflow-hidden"
          style={{
            backgroundColor: `rgb(var(--bg-primary))`,
            borderColor: `rgb(var(--border-color))`,
          }}
        >
          <div
            className="px-4 py-3 border-b font-semibold"
            style={{
              borderColor: `rgb(var(--border-color))`,
              color: `rgb(var(--text-primary))`,
            }}
          >
            Choose Theme
          </div>
          <div className="p-2">
            {themes.map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => handleThemeChange(themeOption.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor:
                    theme === themeOption.id
                      ? `rgb(var(--sidebar-hover))`
                      : 'transparent',
                }}
              >
                <span className="text-2xl">{themeOption.icon}</span>
                <div className="flex-1 text-left">
                  <div
                    className="font-medium"
                    style={{ color: `rgb(var(--text-primary))` }}
                  >
                    {themeOption.name}
                  </div>
                </div>
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{
                      backgroundColor: themeOption.colors.primary,
                      borderColor: `rgb(var(--border-color))`,
                    }}
                  />
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: themeOption.colors.secondary }}
                  />
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: themeOption.colors.accent }}
                  />
                </div>
                {theme === themeOption.id && (
                  <span className="text-green-500">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
