import pino from 'pino'
import {
  type LokiLogEntry,
  initLokiClient,
  getLokiClient,
} from './loki-client.js'
import { formatMessage, type LogOptions, type LoggerApi, type ErrorMetadata } from './shared.js'
import { captureCallerLocation, captureStackTrace, type CallerMetadata } from './caller-metadata.js'

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
  retention: LogOptions['retention'],
  errorMetadata?: ErrorMetadata | null,
  callerMetadata?: CallerMetadata | null,
  stackTrace?: string | null
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
      // Add source location labels for Grafana queries
      ...(callerMetadata?.file && {
        source_file: callerMetadata.file,
        source_function: callerMetadata.function || 'anonymous',
        source_line: String(callerMetadata.line || 0),
      }),
    },
    retentionClass: retention ?? 'short',
    errorMetadata,
    callerMetadata,
    stackTrace,
  }

  await loki.push([entry])
}

class ServerLogger implements LoggerApi {
  private dispatch(
    level: 'info' | 'error' | 'warn' | 'debug' | 'trace',
    opts: LogOptions,
    message: string,
    args: unknown[],
    errorMetadata?: ErrorMetadata | null
  ): void {
    const formattedMessage = formatMessage(message, args)
    // Capture caller location and stack trace for ALL log levels
    const callerMetadata = captureCallerLocation()
    const stackTrace = captureStackTrace()

    // Terminal output (respects isSendedToTerminal + isJsonFormatForTerminal)
    // Default isSendedToTerminal = true
    if (opts.isSendedToTerminal !== false) {
      if (opts.isJsonFormatForTerminal === true) {
        // JSON format (original behavior)
        pinoLogger[level](
          { category: opts.category },
          `${opts.category} ${formattedMessage}`
        )
      } else {
        // Human-readable format (default)
        const timestamp = new Date().toISOString()
        const sourceInfo = callerMetadata.file
          ? ` [${callerMetadata.file}:${callerMetadata.line}:${callerMetadata.column}]`
          : ''
        const stackInfo = stackTrace ? `\n${stackTrace}` : ''
        const prettyLog = `${timestamp} ${level.toUpperCase().padEnd(5)} ${opts.category}${sourceInfo} ${formattedMessage}${stackInfo}`

        if (level === 'error') {
          console.error(prettyLog)
        } else if (level === 'warn') {
          console.warn(prettyLog)
        } else if (level === 'info') {
          console.info(prettyLog)
        } else if (level === 'debug') {
          console.debug(prettyLog)
        } else {
          console.log(prettyLog)
        }
      }
    }

    // Grafana output (respects isSendedToGrafa, default true)
    // Default isSendedToGrafa = true
    if (opts.isSendedToGrafa !== false) {
      sendToLoki(level, opts.category, formattedMessage, opts.retention, errorMetadata, callerMetadata, stackTrace).catch(
        () => {}
      )
    }
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
