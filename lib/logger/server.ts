import pino from 'pino'
import {
  type LokiLogEntry,
  initLokiClient,
  getLokiClient,
} from './loki-client.js'
import { formatMessage, type LogOptions, type LoggerApi } from './shared.js'

const LOG_LEVEL = process.env.LOG_LEVEL || 'debug'
const NODE_ENV = process.env.NODE_ENV || 'development'
const LOKI_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  (process.env.LOKI_ENABLED || '').toLowerCase()
)
const LOKI_SERVICE_NAME = process.env.LOKI_SERVICE_NAME || 'clawagenthub'

const pinoLogger = pino({
  level: LOG_LEVEL,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
})

initLokiClient()
const loki = getLokiClient()

async function sendToLoki(
  level: string,
  category: string,
  message: string,
  retention: LogOptions['retention']
): Promise<void> {
  if (!LOKI_ENABLED || !loki) return

  const entry: LokiLogEntry = {
    timestamp: Date.now() * 1_000_000,
    message: `${category} ${message}`,
    labels: {
      level,
      category: category.slice(1, -1),
      env: NODE_ENV,
      service_name: LOKI_SERVICE_NAME,
      service: LOKI_SERVICE_NAME,
    },
    retentionClass: retention ?? 'short',
  }

  await loki.push([entry])
}

class ServerLogger implements LoggerApi {
  private dispatch(
    level: 'info' | 'error' | 'warn' | 'debug' | 'trace',
    opts: LogOptions,
    message: string,
    args: unknown[]
  ): void {
    const formattedMessage = formatMessage(message, args)
    pinoLogger[level](
      { category: opts.category },
      `${opts.category} ${formattedMessage}`
    )
    sendToLoki(level, opts.category, formattedMessage, opts.retention).catch(
      () => {}
    )
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

const serverLogger = new ServerLogger()

export function getServerLogger(): LoggerApi {
  return serverLogger
}
