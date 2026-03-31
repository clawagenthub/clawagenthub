/**
 * Page Content Components
 *
 * These components extract the content from each page file
 * to be used in reactive SPA-style navigation.
 */

import { DashboardPageContent } from './dashboard-content'
import { ChatPageContent } from './chat-content'
import { GatewaysPageContent } from './gateways-content'
import { StatusesPageContent } from './statuses-content'
import { ProfilePageContent } from './profile-content'
import { SettingsPageContent } from './settings-content'
import type { AppRoute } from '@/lib/contexts/navigation-context'

export interface PageContentProps {
  user: any
}

// Export all content components for direct use if needed
export { DashboardPageContent } from './dashboard-content'
export { ChatPageContent } from './chat-content'
export { GatewaysPageContent } from './gateways-content'
export { StatusesPageContent } from './statuses-content'
export { ProfilePageContent } from './profile-content'
export { SettingsPageContent } from './settings-content'

export function getPageContentComponent(route: AppRoute) {
  switch (route) {
    case 'dashboard':
      return DashboardPageContent
    case 'chat':
      return ChatPageContent
    case 'gateways':
      return GatewaysPageContent
    case 'statuses':
      return StatusesPageContent
    case 'profile':
      return ProfilePageContent
    case 'settings':
      return SettingsPageContent
    default:
      return DashboardPageContent
  }
}
