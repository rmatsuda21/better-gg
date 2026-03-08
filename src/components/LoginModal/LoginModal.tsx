import { useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/use-auth'
import styles from './LoginModal.module.css'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { startOAuthFlow } = useAuth()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          &times;
        </button>
        <div className={styles.icon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className={styles.title}>Connect your start.gg account</h2>
        <p className={styles.description}>
          Sign in to automatically view your tournaments, track your results, and analyze your bracket performance.
        </p>
        <button className={styles.loginButton} onClick={startOAuthFlow}>
          Login with start.gg
        </button>
        <p className={styles.note}>
          You can still search for any player without logging in.
        </p>
      </div>
    </div>
  )
}
