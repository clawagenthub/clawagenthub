/**
 * Error Metadata Extraction Utility
 * Extracts clean source location and metadata from V8 stack traces
 */

export interface ErrorSource {
  file: string | null
  line: number | null
  column: number | null
  function: string | null
}

export interface ErrorMetadata {
  name: string
  message: string
  stack: string | undefined
  source: ErrorSource
  timestamp: string
}

/**
 * Extracts clean source location from V8 stack trace
 * V8 format: "at <function> (<path>:<line>:<column>)"
 */
export function extractSourceLocation(stack: string | undefined): ErrorSource {
  if (!stack) {
    return { file: null, line: null, column: null, function: null }
  }

  const lines = stack.split('\n')
  // Skip first line (Error: <message>) and find first actual location
  const locationLine = lines.find((line) => line.includes('at ')) || lines[0]

  const match = locationLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/)
  if (match) {
    return {
      function: match[1],
      file: match[2],
      line: parseInt(match[3], 10),
      column: parseInt(match[4], 10),
    }
  }

  // Alternative format: "at <function> <path>:<line>:<column>"
  const altMatch = locationLine.match(/at\s+(.+?)\s+(.+?):(\d+):(\d+)/)
  if (altMatch) {
    return {
      function: altMatch[1],
      file: altMatch[2],
      line: parseInt(altMatch[3], 10),
      column: parseInt(altMatch[4], 10),
    }
  }

  return { file: null, line: null, column: null, function: null }
}

/**
 * Full error metadata extractor
 * Captures name, message, stack, source location, and timestamp
 */
export function extractErrorMetadata(error: unknown): ErrorMetadata | null {
  if (!(error instanceof Error)) {
    return null
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    source: extractSourceLocation(error.stack),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Recursively extracts ErrorMetadata from any value (including nested in arrays/objects)
 */
export function extractErrorMetadataDeep(value: unknown): ErrorMetadata | null {
  if (errorIsError(value)) {
    return extractErrorMetadata(value)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = extractErrorMetadataDeep(item)
      if (result) return result
    }
  }

  if (value && typeof value === 'object') {
    // Check common error-adjacent properties
    const keysToCheck = ['error', 'err', 'cause', 'originalError']
    for (const key of keysToCheck) {
      if (key in value) {
        const result = extractErrorMetadataDeep((value as Record<string, unknown>)[key])
        if (result) return result
      }
    }
  }

  return null
}

/**
 * Type guard for Error instances that works across realms
 */
function errorIsError(value: unknown): value is Error {
  if (value instanceof Error) return true
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Error.prototype || proto?.name === 'Error' || proto?.constructor?.name === 'Error'
}
