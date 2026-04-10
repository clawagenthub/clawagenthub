'use client'

import React, { useState, useRef } from 'react'
import { useOnMount } from '@/lib/hooks/use-lifecycle'

export interface DropdownItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  divider?: boolean
  disabled?: boolean
}

interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

export function Dropdown({ trigger, items, align = 'left' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false)
    }
  }

  useOnMount(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  })

  const handleItemClick = (item: DropdownItem) => {
    if (!item.disabled) {
      item.onClick()
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-56 rounded-lg border shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{
            backgroundColor: `rgb(var(--bg-primary))`,
            borderColor: `rgb(var(--border-color))`,
          }}
        >
          <div className="py-1">
            {items.map((item, index) => (
              <React.Fragment key={index}>
                {item.divider && (
                  <div
                    className="my-1 border-t"
                    style={{ borderColor: `rgb(var(--border-color))` }}
                  />
                )}
                <button
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  className={`flex w-full items-center px-4 py-2 text-left text-sm transition-colors ${
                    item.disabled ? 'cursor-not-allowed' : ''
                  }`}
                  style={{
                    color: item.disabled
                      ? `rgb(var(--text-tertiary))`
                      : `rgb(var(--text-primary))`,
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.backgroundColor = `rgb(var(--bg-secondary))`
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  {item.icon && <span className="mr-3">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
