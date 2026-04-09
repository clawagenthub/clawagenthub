import clientLogger from './client.js'
import {
  logCategories,
  type LogOptions,
  type LoggerApi,
  type RetentionClass,
} from './shared.js'

type LoggerMethod = 'info' | 'error' | 'warn' | 'debug' | 'verbose' | 'silly'

let serverLoggerPromise: Promise<LoggerApi> | null = null

function getServerLogger(): Promise<LoggerApi> {
  if (!serverLoggerPromise) {
    serverLoggerPromise = import('./server.js').then((mod) =>
      mod.getServerLogger()
    )
  }
  return serverLoggerPromise
}

if (typeof window === 'undefined') {
  void getServerLogger()
}

class UniversalLogger implements LoggerApi {
  private normalizeArgs(
    optsOrMessage: LogOptions | string,
    messageOrArg: unknown,
    args: unknown[]
  ): { opts: LogOptions; message: string; args: unknown[] } {
    if (
      optsOrMessage &&
      typeof optsOrMessage === 'object' &&
      'category' in optsOrMessage
    ) {
      const opts = optsOrMessage as LogOptions

      if (typeof messageOrArg === 'string') {
        return { opts, message: messageOrArg, args }
      }

      return {
        opts,
        message: String(messageOrArg ?? ''),
        args,
      }
    }

    return {
      opts: { category: logCategories.SYSTEM },
      message: String(optsOrMessage ?? ''),
      args: [messageOrArg, ...args].filter((v) => v !== undefined),
    }
  }

  private dispatch(
    method: LoggerMethod,
    optsOrMessage: LogOptions | string,
    messageOrArg: unknown,
    args: unknown[]
  ): void {
    const normalized = this.normalizeArgs(optsOrMessage, messageOrArg, args)

    if (typeof window !== 'undefined') {
      clientLogger[method](
        normalized.opts,
        normalized.message,
        ...normalized.args
      )
      return
    }

    getServerLogger()
      .then((serverLogger) => {
        serverLogger[method](
          normalized.opts,
          normalized.message,
          ...normalized.args
        )
      })
      .catch(() => {
        // never throw from logger
      })
  }

  info(opts: LogOptions | string, message: unknown, ...args: unknown[]): void {
    this.dispatch('info', opts, message, args)
  }

  error(opts: LogOptions | string, message: unknown, ...args: unknown[]): void {
    this.dispatch('error', opts, message, args)
  }

  warn(opts: LogOptions | string, message: unknown, ...args: unknown[]): void {
    this.dispatch('warn', opts, message, args)
  }

  debug(opts: LogOptions | string, message: unknown, ...args: unknown[]): void {
    this.dispatch('debug', opts, message, args)
  }

  verbose(
    opts: LogOptions | string,
    message: unknown,
    ...args: unknown[]
  ): void {
    this.dispatch('verbose', opts, message, args)
  }

  silly(opts: LogOptions | string, message: unknown, ...args: unknown[]): void {
    this.dispatch('silly', opts, message, args)
  }
}

const logger = new UniversalLogger()

export { logCategories }
export type { RetentionClass }
export default logger
