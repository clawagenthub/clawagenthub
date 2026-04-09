import { useNavigation } from '@/lib/hooks/use-navigation'

interface NavItem {
  id: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'statuses', label: 'Statuses', icon: '🏷️' },
  { id: 'skills', label: 'Skills', icon: '🎯' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

interface NavButtonProps {
  item: NavItem
}

function NavButton({ item }: NavButtonProps) {
  const { navigateTo, isActive } = useNavigation()

  return (
    <li>
      <button
        onClick={() => navigateTo(item.id)}
        className={`flex items-center w-full px-4 py-2 rounded-lg transition-all ${
          isActive(item.id) ? 'font-semibold' : ''
        }`}
        style={{
          color: `rgb(var(--text-primary))`,
          backgroundColor: isActive(item.id)
            ? `rgb(var(--sidebar-active, var(--accent-primary, 59 130 246 / 0.1)))`
            : 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!isActive(item.id)) {
            e.currentTarget.style.backgroundColor = `rgb(var(--sidebar-hover))`
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive(item.id)) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        <span className="mr-3">{item.icon}</span>
        <span>{item.label}</span>
      </button>
    </li>
  )
}

export function SidebarNav() {
  return (
    <nav className="flex-1 p-4">
      <ul className="space-y-2">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </ul>
    </nav>
  )
}
