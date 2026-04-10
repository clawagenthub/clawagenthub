import type { RetentionClass } from './shared.js'
import type { ErrorMetadata } from './shared.js'
import type { CallerMetadata } from './caller-metadata.js'

export interface LokiLogEntry {
  timestamp: number
  message: string
  labels: Record<string, string>
  retentionClass?: RetentionClass
  errorMetadata?: ErrorMetadata
  callerMetadata?: CallerMetadata
}

export interface LokiClientOptions {
  host: string
  basicAuth?: { username: string; password: string }
  headers?: Record<string, string>
  timeout?: number
  batching?: boolean
  batchInterval?: number
  maxBufferSize?: number
  defaultRetention?: RetentionClass
}

export class LokiClient {
  private host: string
  private headers: Record<string, string>
  private timeout: number
  private batching: boolean
  private batchInterval: number
  private maxBufferSize: number
  private defaultRetention: RetentionClass
  private buffer: LokiLogEntry[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(options: LokiClientOptions) {
    this.host = options.host.replace(/\/$/, '')
    this.timeout = options.timeout ?? 30000
    this.batching = options.batching ?? true
    this.batchInterval = options.batchInterval ?? 5000
    this.maxBufferSize = options.maxBufferSize ?? 10000
    this.defaultRetention = options.defaultRetention ?? 'short'

    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (options.basicAuth) {
      const credentials = Buffer.from(
        `${options.basicAuth.username}:${options.basicAuth.password}`
      ).toString('base64')
      this.headers['Authorization'] = `Basic ${credentials}`
    }

    if (this.batching) {
      this.timer = setInterval(() => this.flush(), this.batchInterval)
    }
  }

  async push(logs: LokiLogEntry[]): Promise<void> {
    if (this.stopped) return

    this.buffer.push(...logs)

    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    const logs = this.buffer.splice(0, this.buffer.length)
    await this.send(logs)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    await this.flush()
  }

  private async send(logs: LokiLogEntry[]): Promise<void> {
    const streams: Record<
      string,
      { stream: Record<string, string>; values: [string, string][] }
    > = {}

    for (const log of logs) {
      const labels = {
        ...log.labels,
        retention_class: log.retentionClass || this.defaultRetention,
      }
      const labelKey = JSON.stringify(labels)
      if (!streams[labelKey]) {
        streams[labelKey] = { stream: labels, values: [] }
      }

      // Build message with optional error metadata for Grafana queries
      let message = log.message
      if (log.errorMetadata) {
        const meta = log.errorMetadata
        const sourceInfo = meta.source.file
          ? ` (${meta.source.function || 'unknown'}@${meta.source.file}:${meta.source.line}:${meta.source.column})`
          : ''
        message = `${message}${sourceInfo} | error_name=${meta.name} error_msg=${meta.message} error_stack=${meta.stack || 'none'} error_ts=${meta.timestamp}`
      } else if (log.callerMetadata?.file) {
        // Add caller location metadata for non-error logs
        const cm = log.callerMetadata
        message = `${message} | source_file=${cm.file} source_function=${cm.function || 'anonymous'} source_line=${cm.line}`
      }
      streams[labelKey].values.push([String(log.timestamp), message])
    }

    const payload = {
      streams: Object.values(streams),
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.host}/loki/api/v1/push`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(
          `Loki push failed: ${response.status} ${response.statusText}`
        )
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Loki push timed out')
      } else {
        console.error('Loki push error:', error)
      }
    }
  }
}

let lokiClient: LokiClient | null = null

export function getLokiClient(): LokiClient | null {
  return lokiClient
}

export function initLokiClient(): void {
  const enabled = ['1', 'true', 'yes', 'on'].includes(
    (process.env.LOKI_ENABLED || '').toLowerCase()
  )
  const host = process.env.LOKI_HOST

  if (!enabled || !host) {
    return
  }

  const user = process.env.LOKI_USER || process.env.LOKI_AUTH_USER
  const token = process.env.LOKI_TOKEN || process.env.LOKI_AUTH_PASS
  const batchInterval = parseInt(process.env.LOKI_BATCH_INTERVAL || '5000', 10)
  const defaultRetention = (process.env.LOKI_DEFAULT_RETENTION ||
    'short') as RetentionClass

  lokiClient = new LokiClient({
    host,
    basicAuth: user && token ? { username: user, password: token } : undefined,
    batching: true,
    batchInterval,
    defaultRetention,
  })
}

export async function stopLokiClient(): Promise<void> {
  if (lokiClient) {
    await lokiClient.stop()
    lokiClient = null
  }
}
