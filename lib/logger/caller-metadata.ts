/**
 * Caller Metadata Extraction Utility
 * Extracts source location (file, function, line) from stack trace
 */

export interface CallerMetadata {
  file: string | null
  line: number | null
  column: number | null
  function: string | null
}

/**
 * Extracts clean source location from V8 stack trace
 * Skips internal logger frames to find the actual caller
 *
 * V8 format: "at <function> (<path>:<line>:<column>)"
 */
export function extractCallerLocation(stack: string | undefined): CallerMetadata {
  if (!stack) {
    return { file: null, line: null, column: null, function: null }
  }

  const lines = stack.split('\n')

  // Filter out internal logger frames (lib/logger/*, pino, node:internal)
  // These are always internal to the logger library
  const relevantLines = lines.filter((line) => {
    const lower = line.toLowerCase()
    return !lower.includes('lib/logger/') &&  // internal logger frames
           !lower.includes('pino') &&           // pino internal
           !lower.includes('node:internal')      // node internal
  })

  // Find first line that has a valid V8 location format
  // Two formats: "at <function> (<path>:<line>:<column>)" OR "at <path>:<line>:<column>"
  const matchLine = relevantLines.find((line) => {
    const hasAt = line.includes('at ')
    const hasParensFormat = /at\s+.+\((.+?):(\d+):(\d+)\)/.test(line)
    const hasPathOnlyFormat = /^\s*at\s+([^\s(]+):(\d+):(\d+)/.test(line)
    return hasAt && (hasParensFormat || hasPathOnlyFormat)
  })
  const locationLine = matchLine || relevantLines[0] || lines[0]

  // Match: "at <function> (<path>:<line>:<column>)"
  const match = locationLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/)
  if (match) {
    return {
      function: match[1],
      file: match[2],
      line: parseInt(match[3], 10),
      column: parseInt(match[4], 10),
    }
  }

  // Match: "at <path>:<line>:<column>" (anonymous or global)
  const altMatch = locationLine.match(/at\s+([^\s(]+):(\d+):(\d+)/)
  if (altMatch) {
    return {
      function: null,
      file: altMatch[1],
      line: parseInt(altMatch[2], 10),
      column: parseInt(altMatch[3], 10),
    }
  }

  // Fallback: try to find ANY line with file:line:column pattern
  for (const line of relevantLines) {
    const fallbackMatch = line.match(/at\s+.+\((.+?):(\d+):(\d+)\)/)
    if (fallbackMatch) {
      return {
        function: null,
        file: fallbackMatch[1],
        line: parseInt(fallbackMatch[2], 10),
        column: parseInt(fallbackMatch[3], 10),
      }
    }
  }

  return { file: null, line: null, column: null, function: null }
}

/**
 * Creates a new Error and extracts caller location from its stack
 * Called at the point of the log call to capture accurate location
 */
export function captureCallerLocation(): CallerMetadata {
  const stack = new Error().stack
  return extractCallerLocation(stack)
}

/**
 * Captures full stack trace with 20-frame depth limit
 * Skips internal logger frames (lib/logger/, pino, node:internal)
 * Used for debugging - includes sourceFile in log metadata
 */
export function captureStackTrace(): string | null {
  const stack = new Error().stack
  if (!stack) return null

  const lines = stack.split('\n')
  // Skip first line (the "Error" line itself)
  // Filter: skip lib/logger/, pino, node:internal frames
  const relevantLines = lines
    .slice(1) // skip "Error" line
    .filter((line) => {
      const lower = line.toLowerCase()
      return (
        !lower.includes('lib/logger/') &&
        !lower.includes('pino') &&
        !lower.includes('node:internal')
      )
    })
    .slice(0, 20) // limit to 20 frames

  return relevantLines.length > 0 ? relevantLines.join('\n') : null
}