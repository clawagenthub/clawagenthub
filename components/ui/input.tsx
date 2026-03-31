import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({
  label,
  error,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium"
          style={{ color: `rgb(var(--text-secondary))` }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-lg border px-3 py-2 transition-colors focus:outline-none focus:ring-2 ${className}`}
        style={{
          backgroundColor: `rgb(var(--bg-primary))`,
          borderColor: error ? '#ef4444' : `rgb(var(--border-color))`,
          color: `rgb(var(--text-primary))`,
        }}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
