'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import logger from '@/lib/logger/index.js'

interface CommandBlockProps {
  command: string
  commandId: string
  copiedCommand: string | null
  onCopy: (text: string, id: string) => void
  className?: string
  size?: 'sm' | 'md'
}

function CommandBlock({
  command,
  commandId,
  copiedCommand,
  onCopy,
  className = '',
  size = 'md'
}: CommandBlockProps) {
  const isCopied = copiedCommand === commandId
  const sizeClasses = size === 'sm' ? 'text-xs py-2' : 'text-sm py-3'
  
  return (
    <div className={`relative ${className}`}>
      <div className={`bg-gray-900 text-gray-100 rounded-lg px-4 ${sizeClasses} pr-20 font-mono overflow-x-auto`}>
        {command}
      </div>
      <button
        onClick={() => onCopy(command, commandId)}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
      >
        {isCopied ? (
          <span className="flex items-center text-green-400">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Copied
          </span>
        ) : (
          'Copy'
        )}
      </button>
    </div>
  )
}

// Re-export copy function helper
export function useClipboard() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const copyToClipboard = async (text: string, commandId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCommand(commandId)
      setTimeout(() => setCopiedCommand(null), 2000)
    } catch (err) {
      logger.error('Failed to copy:', err)
    }
  }

  return { copiedCommand, copyToClipboard }
}

export { CommandBlock }
