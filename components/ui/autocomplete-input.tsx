'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTickets, type TicketWithRelations } from '@/lib/query/hooks'

interface AutocompleteInputProps {
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  excludeTicketId?: string
  label?: string
}

export function AutocompleteInput({
  value,
  onChange,
  placeholder = 'Search tickets...',
  disabled = false,
  excludeTicketId,
  label,
}: AutocompleteInputProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Debounce the search term (300ms)
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [searchTerm])

  // Fetch tickets with debounced search term
  const { data: allTickets = [] } = useTickets({ include_drafts: true })

  // Filter tickets based on search term and exclude
  const filteredTickets = allTickets.filter((ticket: TicketWithRelations) => {
    // Exclude current ticket
    if (excludeTicketId && ticket.id === excludeTicketId) {
      return false
    }

    // If no search term, show all (up to 20)
    if (!debouncedSearchTerm.trim()) {
      return true
    }

    const term = debouncedSearchTerm.toLowerCase()
    const ticketNumberMatch = ticket.ticket_number.toString().includes(term)
    const titleMatch = ticket.title.toLowerCase().includes(term)

    return ticketNumberMatch || titleMatch
  }).slice(0, 20)

  // Get the selected ticket for display
  const selectedTicket = allTickets.find((t: TicketWithRelations) => t.id === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        setHighlightedIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredTickets.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredTickets.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredTickets[highlightedIndex]) {
          onChange(filteredTickets[highlightedIndex].id)
          setSearchTerm('')
          setIsOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchTerm('')
        break
    }
  }, [isOpen, filteredTickets, highlightedIndex, onChange])

  const handleSelect = (ticket: TicketWithRelations) => {
    onChange(ticket.id)
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium" style={{ color: `rgb(var(--text-secondary))` }}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : (selectedTicket ? `#${selectedTicket.ticket_number} — ${selectedTicket.title}` : '')}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
            setHighlightedIndex(0)
          }}
          onFocus={() => {
            setIsOpen(true)
            if (selectedTicket) {
              setSearchTerm(`#${selectedTicket.ticket_number} — ${selectedTicket.title}`)
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{
            borderColor: `rgb(var(--border-color))`,
            backgroundColor: `rgb(var(--bg-primary))`,
            color: `rgb(var(--text-primary))`,
          }}
        />
        {selectedTicket && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              color: 'rgb(var(--text-secondary))',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && filteredTickets.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-md border shadow-lg max-h-60 overflow-auto"
          style={{
            borderColor: `rgb(var(--border-color))`,
            backgroundColor: `rgb(var(--bg-primary))`,
          }}
        >
          {filteredTickets.map((ticket, index) => (
            <div
              key={ticket.id}
              onClick={() => handleSelect(ticket)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === highlightedIndex ? 'bg-[var(--accent-primary)] bg-opacity-20' : ''
              }`}
              style={{
                backgroundColor: index === highlightedIndex ? 'rgba(var(--accent-primary), 0.15)' : 'transparent',
                color: `rgb(var(--text-primary))`,
              }}
            >
              <span className="font-medium">#{ticket.ticket_number}</span>
              <span style={{ color: `rgb(var(--text-secondary))` }}> — </span>
              <span>{ticket.title}</span>
            </div>
          ))}
        </div>
      )}

      {isOpen && debouncedSearchTerm && filteredTickets.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-md border shadow-lg p-3"
          style={{
            borderColor: `rgb(var(--border-color))`,
            backgroundColor: `rgb(var(--bg-primary))`,
          }}
        >
          <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
            No tickets found matching "{debouncedSearchTerm}"
          </p>
        </div>
      )}
    </div>
  )
}
