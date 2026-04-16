import {
  formatMessage,
  type LogOptions,
  type LoggerApi,
  logCategories,
  type RetentionClass,
} from './shared.js'

type ClientLogLevel = 'info' | 'error' | 'warn' | 'debug' | 'trace'

async function sendToInternalApi(
  level: ClientLogLevel,
  opts: LogOptions,
  message: string,
  retention: RetentionClass
): Promise<void> {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level,
        category: opts.category,
        message,
        retention,
        metadata: opts.metadata,
      }),
      keepalive: true,
    })
  } catch {
    // never throw from logger in browser runtime
  }
}

class BrowserLogger implements LoggerApi {
  private dispatch(
    level: ClientLogLevel,
    opts: LogOptions,
    message: string,
    args: unknown[]
  ): void {
    const formattedMessage = formatMessage(message, args)
    const retention = opts.retention ?? 'short'

    const payload = `${opts.category} ${formattedMessage}`
    if (level === 'error') console.error(payload)
    else if (level === 'warn') console.warn(payload)
    else if (level === 'info') console.info(payload)
    else console.debug(payload)

    sendToInternalApi(level, opts, formattedMessage, retention).catch(() => {})
  }

  info(opts: LogOptions, message: string, ...args: unknown[]): void {
    this.dispatch('info', opts, message, args)
  }

  error(opts: LogOptions, message: string, ...args: unknown[]): void {
    this.dispatch('error', opts, message, args)
  }

  warn(opts: LogOptions, message: string, ...args: unknown[]): void {
    this.dispatch('warn', opts, message, args)
  }

  debug(opts: LogOptions, message: string, ...args: unknown[]): void {
    this.dispatch('debug', opts, message, args)
  }

  verbose(opts: LogOptions, message: string, ...args: unknown[]): void {
    this.dispatch('trace', opts, message, args)
  }

  silly(opts: LogOptions, message: string, ...args: unknown[]): void {
    this.dispatch('trace', opts, message, args)
  }
}

export function createClientLogger(): LoggerApi {
  return new BrowserLogger()
}

const clientLogger = createClientLogger()

export { logCategories }
export default clientLogger
