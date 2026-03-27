import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { getCharacterStockIcon } from '../../lib/character-utils'
import { formatRoundLabel } from '../../lib/round-label-utils'
import { Skeleton } from '../Skeleton/Skeleton'
import styles from './SetDetailModal.module.css'

interface ModalEntrant {
  id: string | null
  name: string
  playerId: string | null
}

interface GameSelection {
  entrant?: { id?: string | null } | null
  selectionType?: string | null
  selectionValue?: number | null
}

export interface Game {
  orderNum?: number | null
  winnerId?: number | null
  entrant1Score?: number | null
  entrant2Score?: number | null
  selections?: Array<GameSelection | null> | null
  stage?: { id?: string | null; name?: string | null } | null
}

interface SetDetailModalProps {
  isOpen: boolean
  onClose: () => void
  preview: {
    fullRoundText: string | null
    winnerId: string | null
    scores: [string | null, string | null]
    isDQ: boolean
    entrants: [ModalEntrant | null, ModalEntrant | null]
  }
  userEntrantId?: string
  numEntrants?: number
  roundLabel?: string
  games?: Array<Game | null> | null
  gamesLoading?: boolean
  characterMap: Map<number, string>
}

export function SetDetailModal({
  isOpen,
  onClose,
  preview,
  userEntrantId,
  numEntrants,
  roundLabel,
  games,
  gamesLoading,
  characterMap,
}: SetDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Escape key close
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const e0 = preview.entrants[0]
  const e1 = preview.entrants[1]

  // Determine user/opponent sides
  const hasUser = userEntrantId != null
  let leftEntrant: ModalEntrant | null
  let rightEntrant: ModalEntrant | null
  let leftScore: string | null
  let rightScore: string | null

  if (hasUser && e1?.id === userEntrantId) {
    // e1 is user → swap: left=e0 (opp), right=e1 (user)
    leftEntrant = e0
    rightEntrant = e1
    leftScore = preview.scores[0]
    rightScore = preview.scores[1]
  } else if (hasUser && e0?.id === userEntrantId) {
    // e0 is user → left=e1 (opp), right=e0 (user)
    leftEntrant = e1
    rightEntrant = e0
    leftScore = preview.scores[1]
    rightScore = preview.scores[0]
  } else {
    // No user context — render as-is
    leftEntrant = e0
    rightEntrant = e1
    leftScore = preview.scores[0]
    rightScore = preview.scores[1]
  }

  const winnerId = preview.winnerId
  const hasResult = winnerId != null
  const userIsWinner = hasUser && hasResult && winnerId === userEntrantId

  // For symmetric (no user) mode, determine left/right winner status
  const leftIsWinner = hasResult && leftEntrant?.id != null && leftEntrant.id === winnerId
  const rightIsWinner = hasResult && rightEntrant?.id != null && rightEntrant.id === winnerId

  // Games filtering
  const filteredGames = (games ?? []).filter(
    (g): g is NonNullable<typeof g> => g != null,
  )

  return createPortal(
    <div
      className={styles.overlay}
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Set details: ${leftEntrant?.name ?? 'TBD'} vs ${rightEntrant?.name ?? 'TBD'}`}
    >
      <div className={styles.modal}>
        {/* Mobile drag handle */}
        <div className={styles.dragHandle}>
          <div className={styles.dragPill} />
        </div>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.roundText}>
            {roundLabel ?? (preview.fullRoundText ? formatRoundLabel(preview.fullRoundText, numEntrants) : 'Set Details')}
          </span>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Score Banner */}
        <div className={styles.scoreBanner}>
          <div className={styles.bannerPlayer}>
            {leftEntrant?.playerId ? (
              <Link
                to="/player/$playerId"
                params={{ playerId: leftEntrant.playerId }}
                className={styles.bannerName}
                onClick={onClose}
              >
                {leftEntrant.name}
              </Link>
            ) : (
              <span className={styles.bannerName}>{leftEntrant?.name ?? 'TBD'}</span>
            )}
          </div>

          <div className={styles.bannerScores}>
            <div className={styles.scores}>
              <span
                className={`${styles.scoreValue} ${
                  hasResult
                    ? hasUser
                      ? userIsWinner ? styles.scoreLoss : styles.scoreWin
                      : leftIsWinner ? styles.scoreWin : styles.scoreLoss
                    : ''
                }`}
              >
                {leftScore ?? '-'}
              </span>
              <span className={styles.scoreSep}>-</span>
              <span
                className={`${styles.scoreValue} ${
                  hasResult
                    ? hasUser
                      ? userIsWinner ? styles.scoreWin : styles.scoreLoss
                      : rightIsWinner ? styles.scoreWin : styles.scoreLoss
                    : ''
                }`}
              >
                {rightScore ?? '-'}
              </span>
            </div>
          </div>

          <div className={styles.bannerPlayer}>
            {rightEntrant?.playerId ? (
              <Link
                to="/player/$playerId"
                params={{ playerId: rightEntrant.playerId }}
                className={`${styles.bannerName} ${hasUser ? styles.bannerNameUser : ''}`}
                onClick={onClose}
              >
                {rightEntrant.name}
              </Link>
            ) : (
              <span className={`${styles.bannerName} ${hasUser ? styles.bannerNameUser : ''}`}>
                {rightEntrant?.name ?? 'TBD'}
              </span>
            )}
          </div>
        </div>

        {/* Games List */}
        <div className={styles.gamesList}>
          {gamesLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className={styles.gameRow}>
                <Skeleton width="100%" height={36} borderRadius={6} />
              </div>
            ))
          ) : filteredGames.length > 0 ? (
            filteredGames.map((game) => {
              const leftEntrantId = leftEntrant?.id
              const rightEntrantId = rightEntrant?.id

              const leftChar = game.selections?.find(
                (s) =>
                  s?.selectionType === 'CHARACTER' &&
                  s.entrant?.id != null &&
                  leftEntrantId != null &&
                  String(s.entrant.id) === String(leftEntrantId),
              )
              const rightChar = game.selections?.find(
                (s) =>
                  s?.selectionType === 'CHARACTER' &&
                  s.entrant?.id != null &&
                  rightEntrantId != null &&
                  String(s.entrant.id) === String(rightEntrantId),
              )

              const gameWinnerId = game.winnerId != null ? String(game.winnerId) : null
              const gameHasWinner = gameWinnerId != null
              const gameLeftWon = gameHasWinner && leftEntrantId != null && gameWinnerId === String(leftEntrantId)
              const gameRightWon = gameHasWinner && rightEntrantId != null && gameWinnerId === String(rightEntrantId)

              const leftCharName =
                leftChar?.selectionValue != null
                  ? (characterMap.get(leftChar.selectionValue) ??
                    `#${leftChar.selectionValue}`)
                  : null
              const rightCharName =
                rightChar?.selectionValue != null
                  ? (characterMap.get(rightChar.selectionValue) ??
                    `#${rightChar.selectionValue}`)
                  : null

              return (
                <div key={game.orderNum} className={styles.gameRow}>
                  <span className={styles.gameNum}>G{game.orderNum}</span>
                  <div className={`${styles.gameSide} ${styles.left} ${gameHasWinner ? (gameLeftWon ? styles.gameWinSide : styles.gameLossSide) : ''}`}>
                    {leftChar?.selectionValue != null && (
                      <img
                        src={getCharacterStockIcon(leftChar.selectionValue)}
                        alt=""
                        className={styles.charIcon}
                      />
                    )}
                    <span className={styles.charName}>{leftCharName ?? '—'}</span>
                  </div>

                  <span className={styles.vsLabel}>vs</span>

                  <div className={`${styles.gameSide} ${styles.right} ${gameHasWinner ? (gameRightWon ? styles.gameWinSide : styles.gameLossSide) : ''}`}>
                    <span className={styles.charName}>{rightCharName ?? '—'}</span>
                    {rightChar?.selectionValue != null && (
                      <img
                        src={getCharacterStockIcon(rightChar.selectionValue)}
                        alt=""
                        className={styles.charIcon}
                      />
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <p className={styles.noGames}>No game data available</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
