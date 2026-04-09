// theme-types.ts - Theme type definitions for Fast Refresh compliance

export type Theme = 'light' | 'dark' | 'blue' | 'black-red'

export interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}
