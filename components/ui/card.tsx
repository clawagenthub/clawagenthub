import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-lg border p-6 shadow-sm ${className}`}
      style={{
        backgroundColor: `rgb(var(--bg-primary))`,
        borderColor: `rgb(var(--border-color))`,
      }}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`mb-4 ${className}`}>{children}</div>
}

export function CardTitle({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2
      className={`text-2xl font-bold ${className}`}
      style={{ color: `rgb(var(--text-primary))` }}
    >
      {children}
    </h2>
  )
}

export function CardDescription({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={`text-sm ${className}`}
      style={{ color: `rgb(var(--text-secondary))` }}
    >
      {children}
    </p>
  )
}

export function CardContent({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}
