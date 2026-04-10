import { useEffect, useRef } from 'react'

export function useOnMount(effect: () => void | (() => void)): void {
  useEffect(() => effect(), [])
}

export function useOnDestroy(cleanup: () => void): void {
  const cleanupRef = useRef(cleanup)
  cleanupRef.current = cleanup

  useEffect(() => {
    return () => cleanupRef.current()
  }, [])
}

export function useOnChange<T>(
  value: T,
  onChange: (next: T, prev: T | undefined) => void,
  options?: { skipInitial?: boolean }
): void {
  const isFirstRef = useRef(true)
  const prevRef = useRef<T | undefined>(undefined)

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false
      if (options?.skipInitial) {
        prevRef.current = value
        return
      }
    }

    onChange(value, prevRef.current)
    prevRef.current = value
  }, [value, onChange, options?.skipInitial])
}
