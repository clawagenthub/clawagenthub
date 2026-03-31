interface StatusBadgeProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    connected: 'bg-green-100 text-green-800 border-green-200',
    connecting: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    disconnected: 'bg-gray-100 text-gray-800 border-gray-200',
    error: 'bg-red-100 text-red-800 border-red-200',
  }

  const labels = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Error',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      <span className={`w-2 h-2 rounded-full mr-1.5 ${
        status === 'connected' ? 'bg-green-500' :
        status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
        status === 'error' ? 'bg-red-500' :
        'bg-gray-400'
      }`} />
      {labels[status]}
    </span>
  )
}
