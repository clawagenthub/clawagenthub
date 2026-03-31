import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: `rgb(var(--accent-primary))`,
          color: 'white',
        }
      case 'secondary':
        return {
          backgroundColor: `rgb(var(--bg-tertiary))`,
          color: `rgb(var(--text-primary))`,
        }
      case 'danger':
        return {
          backgroundColor: '#ef4444',
          color: 'white',
        }
    }
  }

  return (
    <button
      className={`${baseStyles} ${className}`}
      style={getVariantStyles()}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (variant === 'primary') {
          e.currentTarget.style.backgroundColor = `rgb(var(--accent-hover))`
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') {
          e.currentTarget.style.backgroundColor = `rgb(var(--accent-primary))`
        }
      }}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  )
}
