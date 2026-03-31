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
