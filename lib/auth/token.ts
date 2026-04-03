import { nanoid } from 'nanoid'

export function generateSetupToken(): string {
  return nanoid(64)
}

export function generateSessionToken(): string {
  return nanoid(32)
}

export function generateUserId(): string {
  return nanoid(16)
}

export function generateTicketId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const prefix = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)]
  const suffix = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${prefix}-${suffix}`
}
