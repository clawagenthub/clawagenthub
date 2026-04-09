import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { useNavigation } from '@/lib/hooks/use-navigation'

interface UserMenuProps {
  onLogout: () => void
}

export function SidebarUserMenu({ onLogout }: UserMenuProps) {
  const { navigateTo, isActive } = useNavigation()

  return (
    <div
      className="border-t p-4"
      style={{ borderColor: `rgb(var(--border-color))` }}
    >
      <button
        onClick={() => navigateTo('profile')}
        className={`flex items-center w-full px-4 py-2 mb-2 rounded-lg transition-all ${
          isActive('profile') ? 'font-semibold' : ''
        }`}
        style={{
          color: `rgb(var(--text-primary))`,
          backgroundColor: isActive('profile')
            ? `rgb(var(--sidebar-active, var(--accent-primary, 59 130 246 / 0.1)))`
            : 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!isActive('profile')) {
            e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive('profile')) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        <span className="mr-3">👤</span>
        <span>Profile</span>
      </button>

      <button
        onClick={onLogout}
        className="flex w-full items-center px-4 py-2 mb-3 rounded-lg transition-colors"
        style={{ color: `rgb(var(--text-primary))` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <span className="mr-3">🚪</span>
        <span>Logout</span>
      </button>

      <div className="flex justify-center pt-2">
        <ThemeSwitcher />
      </div>
    </div>
  )
}
