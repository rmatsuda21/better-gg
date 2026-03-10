import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/use-auth'
import { Link } from '@tanstack/react-router'
import styles from './UserMenu.module.css'

export function UserMenu() {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  if (!user) return null

  const initial = (user.gamerTag ?? user.name ?? '?')[0].toUpperCase()

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button className={styles.trigger} onClick={() => setIsOpen((o) => !o)}>
        {user.profileImageUrl ? (
          <img className={styles.avatar} src={user.profileImageUrl} alt="" />
        ) : (
          <span className={styles.avatarFallback}>{initial}</span>
        )}
        <span className={styles.tag}>{user.gamerTag ?? user.name ?? 'User'}</span>
        <svg className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          {user.playerId && (
            <Link
              to="/player/$playerId"
              params={{ playerId: user.playerId }}
              className={styles.dropdownItem}
              onClick={() => setIsOpen(false)}
            >
              View Profile
            </Link>
          )}
          <button
            className={`${styles.dropdownItem} ${styles.disconnect}`}
            onClick={() => {
              setIsOpen(false)
              logout()
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
