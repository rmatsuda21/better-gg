import { useEffect, useState } from 'react'
import { TIMING_MS } from '../lib/constants'

export function useDebouncedValue<T>(value: T, delay: number = TIMING_MS.SEARCH_DEBOUNCE): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
