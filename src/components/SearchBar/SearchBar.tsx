import { useState } from 'react'
import type { FormEvent } from 'react'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  onSearch: (userId: string) => void
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [input, setInput] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed) {
      onSearch(trimmed)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter user discriminator (e.g. 97bc50e1)"
      />
      <button className={styles.button} type="submit" disabled={!input.trim()}>
        Search
      </button>
    </form>
  )
}
