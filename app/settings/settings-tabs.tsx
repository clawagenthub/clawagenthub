'use client'

import { SettingsTab } from './page'

export interface TabConfig {
  key: SettingsTab
  label: string
  icon: string
}

export const SETTINGS_TABS: TabConfig[] = [
  { key: 'general', label: 'General', icon: '⚙️' },
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'flow', label: 'Flow', icon: '🔄' },
  { key: 'workspace', label: 'Workspace', icon: '👥' },
  { key: 'gateway', label: 'Gateway', icon: '🔌' },
  { key: 'defaultprompts', label: 'Default Prompts', icon: '📝' },
  { key: 'prompttemplates', label: 'Prompt Templates', icon: '📋' },
  { key: 'skillsmp', label: 'SkillsMP', icon: '🔌' },
  { key: 'danger', label: 'Danger Zone', icon: '⚠️' },
]

export { SettingsTab }
