// navigation-types.ts - Navigation type definitions for Fast Refresh compliance

export type AppRoute = 'dashboard' | 'chat' | 'statuses' | 'skills' | 'profile' | 'settings'

export interface NavigationContextValue {
  currentRoute: AppRoute
  navigateTo: (route: AppRoute) => void
  isActive: (route: AppRoute) => boolean
}
