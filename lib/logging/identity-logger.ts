/**
 * Identity-aware Grafana logger
 * Injects identity context fields into log metadata.
 */

import logger, { logCategories } from '@/lib/logger/index.js'
import type { LoggerApi, LogOptions } from '@/lib/logger/shared.js'

const REQUEST_IDENTITY_HEADER = 'x-request-identity-id'
const FALLBACK_IDENTITY_HEADER = 'x-identity-id'

export interface IdentityFields {
  identity_id: string
  identity_name: string
  email: string | null
}

export type IdentityLogOptions = LogOptions

let currentIdentity: IdentityFields | null = null

export function setIdentityContext(identity: IdentityFields | null): void {
  currentIdentity = identity
}

export function getIdentityContext(): IdentityFields | null {
  return currentIdentity
}

export function clearIdentityContext(): void {
  currentIdentity = null
}

export function getIdentityIdFromRequest(request: Request): string | null {
  return (
    request.headers.get(REQUEST_IDENTITY_HEADER)?.trim() ||
    request.headers.get(FALLBACK_IDENTITY_HEADER)?.trim() ||
    null
  )
}

export function createIdentityFields(input: {
  id: string
  name: string
  email?: string | null
}): IdentityFields {
  return {
    identity_id: input.id,
    identity_name: input.name,
    email: input.email ?? null,
  }
}

function injectIdentity<T extends LogOptions>(opts: T): IdentityLogOptions {
  if (!currentIdentity) {
    return opts
  }

  return {
    ...opts,
    metadata: {
      ...opts.metadata,
      identity_id: currentIdentity.identity_id,
      identity_name: currentIdentity.identity_name,
      email: currentIdentity.email,
    },
  }
}

export const identityLogger: LoggerApi = {
  info(opts: LogOptions, message: string, ...args: unknown[]): void {
    logger.info(injectIdentity(opts), message, ...args)
  },

  error(opts: LogOptions, message: string, ...args: unknown[]): void {
    logger.error(injectIdentity(opts), message, ...args)
  },

  warn(opts: LogOptions, message: string, ...args: unknown[]): void {
    logger.warn(injectIdentity(opts), message, ...args)
  },

  debug(opts: LogOptions, message: string, ...args: unknown[]): void {
    logger.debug(injectIdentity(opts), message, ...args)
  },

  verbose(opts: LogOptions, message: string, ...args: unknown[]): void {
    logger.verbose(injectIdentity(opts), message, ...args)
  },

  silly(opts: LogOptions, message: string, ...args: unknown[]): void {
    logger.silly(injectIdentity(opts), message, ...args)
  },
}

export { logCategories }
export default identityLogger
