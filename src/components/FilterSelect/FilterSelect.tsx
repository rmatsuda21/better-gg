import { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, KeyboardEvent } from 'react'
import styles from './FilterSelect.module.css'

interface FilterSelectOption {
  value: string
  label: string
  icon?: string
}

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  variant?: 'hero'
  className?: string
  style?: CSSProperties
  placeholder?: string
  searchThreshold?: number
  'aria-label'?: string
}

export type { FilterSelectOption, FilterSelectProps }

export function FilterSelect({
  value,
  onChange,
  options,
  variant,
  className,
  style,
  placeholder = 'Select...',
  searchThreshold = 8,
  'aria-label': ariaLabel,
}: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const id = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const showSearch = options.length >= searchThreshold

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options
    const q = searchQuery.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, searchQuery])

  const selectedLabel = useMemo(() => {
    const match = options.find((o) => o.value === value)
    return match?.label ?? placeholder
  }, [options, value, placeholder])

  // Compute dropdown position from trigger bounding rect
  const [ddPos, setDdPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDdPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [isOpen])

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen && showSearch) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [isOpen, showSearch])

  // Reset search + active index when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setActiveIndex(-1)
    }
  }, [isOpen])

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const select = useCallback(
    (val: string) => {
      onChange(val)
      setIsOpen(false)
    },
    [onChange],
  )

  function handleTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      setIsOpen(true)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i < filteredOptions.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i > 0 ? i - 1 : filteredOptions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && filteredOptions[activeIndex]) {
        select(filteredOptions[activeIndex].value)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(filteredOptions.length - 1)
    }
  }

  const triggerClasses = [
    styles.trigger,
    isOpen ? styles.triggerOpen : '',
    variant === 'hero' ? styles.hero : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const listboxId = `${id}-listbox`

  return (
    <div className={styles.wrapper} ref={wrapperRef} style={style}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClasses}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.triggerLabel}>{selectedLabel}</span>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen &&
        ddPos &&
        createPortal(
          <>
            <div
              className={styles.backdrop}
              onMouseDown={(e) => {
                e.preventDefault()
                setIsOpen(false)
              }}
            />
            <div
              className={styles.dropdown}
              role="listbox"
              id={listboxId}
              onKeyDown={handleKeyDown}
              style={
                {
                  '--dd-top': `${ddPos.top}px`,
                  '--dd-left': `${ddPos.left}px`,
                  '--dd-min-width': `${ddPos.width}px`,
                } as CSSProperties
              }
            >
              {showSearch && (
                <input
                  ref={searchRef}
                  className={styles.searchInput}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setActiveIndex(-1)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  autoComplete="off"
                />
              )}
              <div className={styles.optionList} ref={listRef}>
                {filteredOptions.length === 0 ? (
                  <div className={styles.emptyMessage}>No matches</div>
                ) : (
                  filteredOptions.map((opt, index) => (
                    <div
                      key={opt.value}
                      id={`${id}-option-${index}`}
                      role="option"
                      aria-selected={opt.value === value}
                      className={[
                        styles.option,
                        index === activeIndex ? styles.optionActive : '',
                        opt.value === value ? styles.optionSelected : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        select(opt.value)
                      }}
                    >
                      {opt.icon && (
                        <img src={opt.icon} alt="" className={styles.optionIcon} />
                      )}
                      {opt.label}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}
